import { generateId } from '@usepilot/utils'
import type {
  ExecutionBlueprint,
  Task,
  Goal,
  Intent,
  SuccessCriteria,
  ApprovalSummary,
  PlannerContextSnapshot,
  ApprovalPolicy,
} from '@usepilot/planner-types'
import { GraphBuilder, PlanSerializer, ApprovalEngine } from '@usepilot/planner-core'
import type { Skill, Workflow, WorkflowCompileOptions } from '@usepilot/skill-types'

export interface CompiledSkillResult {
  workflow: Workflow
  blueprint: ExecutionBlueprint
}

/**
 * SkillWorkflowCompiler — Compiles a resolved Skill into a deterministic Workflow and ExecutionBlueprint.
 *
 * Sits directly between the Skill layer and the Planner layer:
 * Skill -> Workflow -> Existing Planner Components -> ExecutionBlueprint.
 *
 * Ensures:
 * - Deterministic task generation without hallucination
 * - Standard Kahn DAG construction
 * - Full compliance with existing approval policies
 * - SHA-256 fingerprinting via PlanSerializer
 */
export class SkillWorkflowCompiler {
  private readonly graphBuilder = new GraphBuilder()
  private readonly approvalEngine = new ApprovalEngine()
  private readonly serializer = new PlanSerializer()

  async compile(
    skill: Skill,
    inputs: Record<string, unknown>,
    options: WorkflowCompileOptions = {}
  ): Promise<CompiledSkillResult> {
    const {
      workflowId = generateId(),
      platform = 'windows',
    } = options

    // 1. Generate task templates from skill definition
    const templates = skill.workflowDefinition.generateTasks(inputs)
    if (templates.length === 0) {
      throw new Error(`Skill "${skill.id}" workflow definition generated 0 tasks.`)
    }

    // 2. Instantiate Planner Tasks
    const idMap = new Map<string, string>()
    for (const t of templates) {
      idMap.set(t.id, `${skill.id}-${t.id}-${generateId().slice(0, 6)}`)
    }

    let tasks: Task[] = templates.map((tmpl) => {
      const concreteId = idMap.get(tmpl.id) ?? tmpl.id
      const remappedDependsOn = tmpl.dependsOn.map((dep) => idMap.get(dep) ?? dep)

      // Determine default approval policy if not specified
      let approvalPolicy: ApprovalPolicy = tmpl.approvalPolicy ?? 'automatic'
      if (!tmpl.approvalPolicy) {
        if (skill.riskLevel === 'critical' || skill.riskLevel === 'high') {
          approvalPolicy = 'mandatory'
        } else if (skill.riskLevel === 'medium' && (tmpl.category === 'modification' || tmpl.category === 'deletion')) {
          approvalPolicy = 'optional'
        }
      }

      return {
        id: concreteId,
        title: tmpl.title,
        description: tmpl.description,
        category: tmpl.category ?? 'computation',
        requiredCapability: tmpl.requiredCapability,
        toolConfig: tmpl.toolConfigFactory(inputs),
        expectedOutput: tmpl.description,
        preconditions: tmpl.preconditions,
        postconditions: tmpl.postconditions,
        successConditions: tmpl.successConditions,
        failureConditions: tmpl.failureConditions ?? [],
        dependsOn: remappedDependsOn,
        approvalPolicy,
        approvalReason: tmpl.approvalReason ?? (approvalPolicy === 'mandatory' ? `Skill "${skill.name}" has ${skill.riskLevel} risk level.` : undefined),
        complexity: tmpl.complexity ?? skill.workflowDefinition.estimatedComplexity,
        retryPolicy: {
          maxAttempts: Math.max(1, skill.failurePolicy.maxRetries),
          backoffMs: 300,
          exponential: true,
        },
        failureStrategy: {
          onFailure: skill.failurePolicy.allowFallback ? 'fallback' : 'abort',
          fallbackTaskId: skill.failurePolicy.fallbackSkillId,
        },
        confidence: 0.98,
      }
    })

    // Run approval engine over tasks to enforce system-wide safety governance
    tasks = tasks.map((task) => {
      const evaluated = this.approvalEngine.evaluate(task)
      let finalPolicy: ApprovalPolicy = task.approvalPolicy
      let finalReason = task.approvalReason

      if (finalPolicy !== 'mandatory' && finalPolicy !== 'forbidden') {
        finalPolicy = evaluated.policy
        finalReason = evaluated.reason
      } else if (!finalReason) {
        finalReason = evaluated.reason
      }

      return {
        ...task,
        approvalPolicy: finalPolicy,
        approvalReason: finalReason,
      }
    })

    // 3. Build DAG using Kahn's algorithm
    const graph = this.graphBuilder.build(tasks)

    // 4. Build Success Criteria
    const successCriteria: SuccessCriteria[] = skill.verificationDefinition.conditions.map((condition) => ({
      condition,
      verificationStrategy: skill.verificationDefinition.strategy === 'checksum'
        ? 'state_check'
        : skill.verificationDefinition.strategy === 'dom_check'
          ? 'screenshot'
          : skill.verificationDefinition.strategy === 'file_exists'
            ? 'file_exists'
            : 'state_check',
      required: true,
    }))

    // 5. Build Goal & Intent
    const goal: Goal = {
      id: generateId(),
      primaryObjective: skill.name,
      constraints: [],
      requiredResources: [...skill.requiredCapabilities],
      expectedOutcome: skill.description,
      confidence: 1.0,
      status: 'validated',
      normalizedInput: {
        text: skill.name,
        originalText: skill.name,
        detectedLanguage: 'en',
        entities: [],
        durationMs: 0,
      },
      createdAt: Date.now(),
    }

    const intent: Intent = {
      type: skill.category === 'filesystem'
        ? 'filesystem'
        : skill.category === 'browser'
          ? 'browser'
          : skill.category === 'desktop'
            ? 'desktop'
            : 'mixed',
      riskLevel: skill.riskLevel,
      complexity: skill.workflowDefinition.estimatedComplexity,
      requiresHumanApproval: tasks.some((t) => t.approvalPolicy === 'mandatory'),
      missingInformation: [],
      confidence: 1.0,
      durationMs: 0,
    }

    const approvals: ApprovalSummary = {
      requiresMandatoryApproval: tasks.some((t) => t.approvalPolicy === 'mandatory'),
      hasForbiddenTasks: tasks.some((t) => t.approvalPolicy === 'forbidden'),
      mandatoryTaskIds: tasks.filter((t) => t.approvalPolicy === 'mandatory').map((t) => t.id),
      optionalTaskIds: tasks.filter((t) => t.approvalPolicy === 'optional').map((t) => t.id),
      forbiddenTaskIds: tasks.filter((t) => t.approvalPolicy === 'forbidden').map((t) => t.id),
    }

    const plannerContext: PlannerContextSnapshot = {
      platform,
      availableTools: [],
      settingsSnapshot: {},
      previousBlueprintCount: 0,
    }

    // 6. Build and Serialize Blueprint
    const rawBlueprint: ExecutionBlueprint = {
      id: generateId(),
      version: 1,
      hash: '',
      status: 'ready',
      goal,
      intent,
      tasks,
      graph,
      approvals,
      successCriteria,
      estimatedComplexity: skill.workflowDefinition.estimatedComplexity,
      optimization: {
        mergedTasks: [],
        removedDuplicates: [],
        newParallelGroups: [],
        simplifications: [],
        changed: false,
      },
      explanation: {
        summary: `Executing Skill "${skill.name}" (v${skill.version}) with verified parameters.`,
        reasoning: [`Deterministic skill workflow generated ${tasks.length} atomic task(s).`],
        assumptions: [`Host platform is ${platform}.`],
        tradeoffs: ['Deterministic task generation prioritized over open-ended LLM planning.'],
        riskAssessment: `Skill risk level evaluated as ${skill.riskLevel}.`,
      },
      plannerConfidence: 1.0,
      plannerContext,
      createdAt: Date.now(),
    }

    const serializedBlueprint = await this.serializer.serialize(rawBlueprint, 1)

    const workflow: Workflow = {
      id: workflowId,
      skillId: skill.id,
      skillVersion: skill.version,
      name: skill.name,
      description: skill.description,
      inputs,
      tasks,
      expectedOutputs: {},
      verificationCriteria: successCriteria,
      policyHints: {
        riskLevel: skill.riskLevel,
        approvalPolicy: approvals.requiresMandatoryApproval ? 'mandatory' : undefined,
        timeoutMs: skill.workflowDefinition.timeoutMs,
      },
      metadata: {
        createdAt: Date.now(),
        author: skill.metadata.author,
        tags: skill.metadata.tags,
      },
    }

    return {
      workflow,
      blueprint: serializedBlueprint,
    }
  }
}
