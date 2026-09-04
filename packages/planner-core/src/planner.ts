// ─────────────────────────────────────────────────────────────────────────────
// Planner — Main Orchestrator
// Coordinates the full Phase 2 planning pipeline:
//   Normalizer → GoalExtractor → GoalValidator → IntentAnalyzer
//   → TaskGenerator → ApprovalEngine → GraphBuilder
//   → SchemaValidator → SemanticValidator → ExecutionValidator
//   → PlanOptimizer → PlanSerializer
//
// All AI calls are confined to: GoalExtractor, IntentAnalyzer, TaskGenerator.
// Everything else is deterministic.
// ─────────────────────────────────────────────────────────────────────────────

import type {
  ExecutionBlueprint,
  PlannerContext,
  PlanningStage,
  ValidationResult,
  Complexity,
  ApprovalSummary,
  SuccessCriteria,
  PlannerContextSnapshot,
} from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'
import type { AIProvider } from '@usepilot/ai-core'
import { Normalizer } from './normalizer/normalizer'
import { GoalExtractor } from './goal/extractor'
import { GoalValidator } from './goal/validator'
import { IntentAnalyzer } from './intent/analyzer'
import { TaskGenerator } from './tasks/generator'
import { ApprovalEngine } from './approval/approval-engine'
import { GraphBuilder } from './graph/builder'
import { SchemaValidator } from './validation/schema-validator'
import { SemanticValidator } from './validation/semantic-validator'
import { ExecutionValidator } from './validation/execution-validator'
import { PlanOptimizer } from './optimizer/plan-optimizer'
import { PlanSerializer } from './serializer'
import { PlannerError } from './errors'

export type ProgressCallback = (stage: PlanningStage, progressPct: number, message: string) => void | Promise<void>

export interface PlannerOptions {
  model: string
  version?: number | undefined
  onProgress?: ProgressCallback | undefined
}

export interface PlanResult {
  blueprint: ExecutionBlueprint
  validation: ValidationResult
  totalDurationMs: number
  tokenCount: number
}

import { MissingInformationDetector } from './goal/missing-info-detector'
import { PlanExplainer } from './explainer/plan-explainer'

function computePlannerConfidence(
  goalConfidence: number,
  intentConfidence: number,
  missingInfoPenalty: number,
  warningCount: number
): number {
  const base = goalConfidence * 0.5 + intentConfidence * 0.5
  const validationPenalty = Math.min(warningCount * 0.05, 0.15)
  const score = base - missingInfoPenalty - validationPenalty
  return Math.max(0.1, Math.min(1.0, Math.round(score * 100) / 100))
}

export class Planner {
  private readonly normalizer = new Normalizer()
  private readonly goalExtractor: GoalExtractor
  private readonly goalValidator = new GoalValidator()
  private readonly missingInfoDetector = new MissingInformationDetector()
  private readonly intentAnalyzer: IntentAnalyzer
  private readonly taskGenerator: TaskGenerator
  private readonly approvalEngine = new ApprovalEngine()
  private readonly graphBuilder = new GraphBuilder()
  private readonly schemaValidator = new SchemaValidator()
  private readonly semanticValidator = new SemanticValidator()
  private readonly executionValidator: ExecutionValidator
  private readonly optimizer = new PlanOptimizer()
  private readonly planExplainer = new PlanExplainer()
  private readonly serializer = new PlanSerializer()

  constructor(private readonly provider: AIProvider) {
    this.goalExtractor = new GoalExtractor(provider)
    this.intentAnalyzer = new IntentAnalyzer(provider)
    this.taskGenerator = new TaskGenerator(provider)
    this.executionValidator = new ExecutionValidator()
  }

  async plan(rawText: string, context: PlannerContext, options: PlannerOptions): Promise<PlanResult> {
    const start = Date.now()
    const { model, version = 1, onProgress } = options
    const progress = async (stage: PlanningStage, pct: number, msg: string) => {
      if (onProgress) await onProgress(stage, pct, msg)
    }

    // ── Stage 1: Normalize ────────────────────────────────────────────────────
    await progress('normalizing', 5, 'Normalizing input...')
    const normalizedInput = this.normalizer.normalize(rawText)

    // ── Stage 2: Extract Goal ─────────────────────────────────────────────────
    await progress('extracting', 15, 'Extracting goal from input...')
    const goal = await this.goalExtractor.extract(normalizedInput, model)

    // ── Stage 3: Validate Goal ────────────────────────────────────────────────
    await progress('validating_goal', 22, 'Validating goal completeness...')
    this.goalValidator.validateOrThrow(goal)

    // ── Stage 3.5: Detect Missing Information ─────────────────────────────────
    await progress('detecting_missing_info', 27, 'Detecting missing information...')
    const missingInfoResult = this.missingInfoDetector.detect(goal)
    if (missingInfoResult.items.length > 0) {
      goal.missingInformation = missingInfoResult.items
    }

    // ── Stage 4: Analyze Intent ───────────────────────────────────────────────
    await progress('analyzing', 35, 'Analyzing intent and risk...')
    const intent = await this.intentAnalyzer.analyze(goal, context, model)

    // ── Stage 5: Generate Tasks ───────────────────────────────────────────────
    await progress('generating', 48, 'Generating atomic task list...')
    let tasks = await this.taskGenerator.generate(goal, intent, context, model)

    // ── Stage 6: Assign Approval Policies ────────────────────────────────────
    await progress('generating', 58, 'Assigning approval policies...')
    tasks = this.approvalEngine.assignPolicies(tasks)

    // ── Stage 7: Build Graph ──────────────────────────────────────────────────
    await progress('building', 65, 'Building execution graph...')
    const graph = this.graphBuilder.build(tasks)

    // ── Stage 8: Build partial blueprint for validation ───────────────────────
    const partialBlueprint: Omit<ExecutionBlueprint, 'hash' | 'version'> = {
      id: generateId(),
      status: missingInfoResult.hasCriticalMissingInfo ? 'needs_info' : 'ready',
      goal,
      intent,
      tasks,
      graph,
      approvals: this.buildApprovalSummary(tasks),
      successCriteria: this.buildSuccessCriteria(tasks),
      estimatedComplexity: intent.complexity,
      optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
      plannerContext: this.buildContextSnapshot(context),
      createdAt: Date.now(),
    }

    // ── Stage 9: Three-layer validation ──────────────────────────────────────
    await progress('validating', 72, 'Running schema validation...')
    const schemaResult = this.schemaValidator.validate(partialBlueprint as ExecutionBlueprint)

    await progress('validating', 78, 'Running semantic validation...')
    const semanticResult = schemaResult.passed
      ? this.semanticValidator.validate(partialBlueprint as ExecutionBlueprint)
      : { layer: 'semantic' as const, passed: false, issues: [], durationMs: 0 }

    await progress('validating', 83, 'Running execution validation...')
    const executionResult = semanticResult.passed
      ? this.executionValidator.validate(partialBlueprint as ExecutionBlueprint, context)
      : { layer: 'execution' as const, passed: false, issues: [], durationMs: 0 }

    const allIssues = [
      ...schemaResult.issues,
      ...semanticResult.issues,
      ...executionResult.issues,
    ]
    const validation: ValidationResult = {
      valid: schemaResult.passed && semanticResult.passed && executionResult.passed,
      schema: schemaResult,
      semantic: semanticResult,
      execution: executionResult,
      errors: allIssues.filter((i) => i.severity === 'error'),
      warnings: allIssues.filter((i) => i.severity === 'warning'),
      suggestions: allIssues.filter((i) => i.severity === 'suggestion'),
      totalDurationMs: schemaResult.durationMs + semanticResult.durationMs + executionResult.durationMs,
    }

    // Check for forbidden tasks — plan is rejected
    const hasForbidden = tasks.some((t) => t.approvalPolicy === 'forbidden')
    if (hasForbidden) {
      const forbidden = tasks.filter((t) => t.approvalPolicy === 'forbidden')
      throw PlannerError.forbiddenTask(
        forbidden.map((t) => t.title).join(', '),
        forbidden.map((t) => t.approvalReason ?? '').join('; ')
      )
    }

    // ── Stage 10: Optimize ────────────────────────────────────────────────────
    await progress('optimizing', 88, 'Optimizing task graph...')
    const optimized = this.optimizer.optimize(tasks, graph)

    // ── Stage 10.5: Explain Plan ──────────────────────────────────────────────
    await progress('explaining', 93, 'Synthesizing plan explanation...')
    const explanation = this.planExplainer.explain(
      goal,
      intent,
      optimized.tasks,
      optimized.graph,
      this.buildApprovalSummary(optimized.tasks),
      context
    )

    const missingPenalty = missingInfoResult.hasCriticalMissingInfo
      ? 0.35
      : missingInfoResult.items.length > 0
        ? 0.1
        : 0
    const plannerConfidence = computePlannerConfidence(
      goal.confidence ?? 0.85,
      intent.confidence ?? 0.85,
      missingPenalty,
      validation.warnings.length
    )

    // ── Stage 11: Serialize ───────────────────────────────────────────────────
    await progress('serializing', 96, 'Finalizing blueprint...')
    const finalBlueprint: ExecutionBlueprint = {
      ...partialBlueprint,
      status: missingInfoResult.hasCriticalMissingInfo ? 'needs_info' : 'ready',
      tasks: optimized.tasks,
      graph: optimized.graph,
      approvals: this.buildApprovalSummary(optimized.tasks),
      successCriteria: this.buildSuccessCriteria(optimized.tasks),
      optimization: optimized.optimization,
      explanation,
      plannerConfidence,
      hash: '',
      version,
    }
    const serialized = await this.serializer.serialize(finalBlueprint, version)

    await progress('ready', 100, 'Blueprint ready.')

    return {
      blueprint: serialized,
      validation,
      totalDurationMs: Date.now() - start,
      tokenCount: 0, // populated by PlannerService from provider usage data
    }
  }

  private buildApprovalSummary(tasks: import('@usepilot/planner-types').Task[]): ApprovalSummary {
    return {
      requiresMandatoryApproval: tasks.some((t) => t.approvalPolicy === 'mandatory'),
      hasForbiddenTasks: tasks.some((t) => t.approvalPolicy === 'forbidden'),
      mandatoryTaskIds: tasks.filter((t) => t.approvalPolicy === 'mandatory').map((t) => t.id),
      optionalTaskIds: tasks.filter((t) => t.approvalPolicy === 'optional').map((t) => t.id),
      forbiddenTaskIds: tasks.filter((t) => t.approvalPolicy === 'forbidden').map((t) => t.id),
    }
  }

  private buildSuccessCriteria(tasks: import('@usepilot/planner-types').Task[]): SuccessCriteria[] {
    // Derive criteria from the last task's postconditions + success conditions
    const lastTask = tasks[tasks.length - 1]
    if (!lastTask) return []
    return lastTask.successConditions.map((condition) => ({
      condition,
      verificationStrategy: 'state_check' as const,
      required: true,
    }))
  }

  private buildContextSnapshot(ctx: PlannerContext): PlannerContextSnapshot {
    return {
      platform: ctx.platform,
      availableTools: ctx.availableTools,
      settingsSnapshot: ctx.settings as unknown as Record<string, unknown>,
      previousBlueprintCount: ctx.previousBlueprints.length,
    }
  }
}

export { PlannerError } from './errors'
