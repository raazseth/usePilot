import { generateId } from '@usepilot/utils'
import type { SkillComposition, ComposedExecutionReceipt, StepExecutionReceipt, StepCompletionEvent } from '@usepilot/skill-types'
import type { CapabilityRegistry } from '@usepilot/execution-core'
import { createExecutionRunner, createProductionRegistry } from '@usepilot/execution-core'

import type { SkillRegistry } from '../registry/skill-registry'
import { SkillResolver } from '../resolver/skill-resolver'
import { SkillWorkflowCompiler } from '../workflow/compiler'
import { SkillVerifier } from '../verification/skill-verifier'
import { CompositionValidator } from './composition-validator'
import { OutputCollector } from './output-collector'

export interface OrchestrationOptions {
  /**
   * Called immediately after each step finishes (success or failure).
   * Useful for progress UIs, logging, or telemetry hooks.
   */
  onStepComplete?: ((event: StepCompletionEvent) => void) | undefined
  /** Target platform — passed to SkillWorkflowCompiler. Defaults to 'windows'. */
  platform?: 'windows' | 'macos' | 'linux' | undefined
  /** Optional run ID for ExecutionRunner correlation. Auto-generated if omitted. */
  runId?: string | undefined
  /** Optional trace ID for ExecutionRunner correlation. Auto-generated if omitted. */
  traceId?: string | undefined
  /**
   * CapabilityRegistry injected into ExecutionRunner.
   * Defaults to createProductionRegistry() for real execution.
   * Pass createDefaultRegistry() (stubs) in tests that don't touch the real filesystem/browser.
   */
  executionRegistry?: CapabilityRegistry | undefined
}

/**
 * ComposedWorkflowOrchestrator — Executes a SkillComposition step by step.
 *
 * This is the central Phase 7 engine. It orchestrates the existing pipeline:
 *   CompositionValidator → OutputCollector → SkillResolver → SkillWorkflowCompiler
 *   → ExecutionRunner → SkillVerifier → OutputCollector.record()
 *
 * It does NOT:
 * - Create a second Planner
 * - Create autonomous retry loops
 * - Make LLM calls
 * - Modify SkillComposer, SkillWorkflowCompiler, or ExecutionRunner
 *
 * Approval gate behavior:
 * - If a compiled per-step blueprint requires mandatory approval, execution pauses
 *   immediately (before running that step) and returns { status: 'approval_required' }.
 * - Callers are responsible for resuming after obtaining approval (future Phase).
 */
export class ComposedWorkflowOrchestrator {
  private readonly validator: CompositionValidator
  private readonly resolver = new SkillResolver()
  private readonly compiler = new SkillWorkflowCompiler()
  private readonly verifier = new SkillVerifier()

  constructor(private readonly registry: SkillRegistry) {
    this.validator = new CompositionValidator(registry)
  }

  async execute(
    composition: SkillComposition,
    initialInputs: Record<string, unknown> = {},
    options: OrchestrationOptions = {}
  ): Promise<ComposedExecutionReceipt> {
    const startTime = Date.now()
    const {
      platform = 'windows',
      runId = generateId(),
      traceId = generateId(),
      onStepComplete,
      executionRegistry,
    } = options

    // ── Step 0: Validate composition graph ────────────────────────────────────
    const validation = this.validator.validate(composition)
    if (!validation.valid) {
      const detail = validation.errors.map((e) => `[${e.type}] ${e.detail}`).join('; ')
      return {
        compositionId: composition.id,
        compositionVersion: composition.version,
        status: 'failed',
        stepReceipts: [],
        totalTasksExecuted: 0,
        durationMs: Date.now() - startTime,
        error: `Composition validation failed: ${detail}`,
      }
    }

    const collector = new OutputCollector()
    const stepReceipts: StepExecutionReceipt[] = []
    let totalTasksExecuted = 0

    // ── Step loop ─────────────────────────────────────────────────────────────
    for (let i = 0; i < composition.steps.length; i++) {
      const step = composition.steps[i]!
      const stepStart = Date.now()

      // 1. Resolve step inputs from bindings + prior step outputs + initial inputs
      const resolvedRaw = collector.resolveAll(step.inputBindings, initialInputs)

      // 2. Resolve skill (already validated to exist)
      const skill = this.registry.get(step.skillId)!

      // 3. Validate and configure inputs via SkillResolver
      const resolution = this.resolver.resolve(skill, resolvedRaw, { platform })
      if (!resolution.success) {
        const receipt: StepExecutionReceipt = {
          stepId: step.stepId,
          skillId: step.skillId,
          status: 'failed',
          verified: false,
          durationMs: Date.now() - stepStart,
          outputs: {},
          error: resolution.userPromptRequired ?? `Step "${step.stepId}" failed resolution: ${resolution.status}`,
        }
        stepReceipts.push(receipt)

        onStepComplete?.({
          stepId: step.stepId,
          skillId: step.skillId,
          stepIndex: i,
          totalSteps: composition.steps.length,
          status: 'failed',
          durationMs: receipt.durationMs,
          outputs: {},
        })

        // If this step is not optional, abort the composition
        if (!step.isOptional) {
          return {
            compositionId: composition.id,
            compositionVersion: composition.version,
            status: 'failed',
            stepReceipts,
            totalTasksExecuted,
            durationMs: Date.now() - startTime,
            error: receipt.error,
          }
        }
        continue
      }

      // 4. Compile per-step blueprint
      const { blueprint } = await this.compiler.compile(
        skill,
        resolution.configuredInputs,
        { platform }
      )

      // 5. Approval gate — pause before running mandatory-approval blueprints
      if (blueprint.approvals.requiresMandatoryApproval) {
        return {
          compositionId: composition.id,
          compositionVersion: composition.version,
          status: 'approval_required',
          stepReceipts,
          totalTasksExecuted,
          durationMs: Date.now() - startTime,
          pendingApprovalStepId: step.stepId,
        }
      }

      // 6. Execute via existing ExecutionRunner
      const registry = executionRegistry ?? createProductionRegistry()
      const { runner } = createExecutionRunner(`${runId}-step${i}`, `${traceId}-step${i}`, registry)
      const executionResult = await runner.run(
        `${runId}-step${i}`,
        `${traceId}-step${i}`,
        blueprint
      )

      totalTasksExecuted += executionResult.tasksCompleted

      // 7. Collect step outputs for subsequent steps.
      // Since ExecutionResult does not expose per-task structured outputs, we record
      // the resolved and validated inputs of this step (configuredInputs) as the step's
      // "outputs". This is correct for the vast majority of compositions: the next step
      // needs the same values (e.g. a folder path, URL) that the current step operated on.
      // Future phases may extend this with adapter-level output capture.
      const stepOutputs: Record<string, unknown> = { ...resolution.configuredInputs }
      collector.record(step.stepId, stepOutputs)


      // 8. Verify outcome via SkillVerifier
      const verification = this.verifier.verify(skill, resolution.configuredInputs, executionResult)

      const stepDuration = Date.now() - stepStart
      const stepStatus = executionResult.status === 'completed' ? 'completed' : 'failed'

      const receipt: StepExecutionReceipt = {
        stepId: step.stepId,
        skillId: step.skillId,
        status: stepStatus,
        verified: verification.verified,
        durationMs: stepDuration,
        outputs: stepOutputs,
        error: stepStatus === 'failed'
          ? `Execution ended with status "${executionResult.status}"`
          : undefined,
      }
      stepReceipts.push(receipt)

      // 9. Emit progress event
      onStepComplete?.({
        stepId: step.stepId,
        skillId: step.skillId,
        stepIndex: i,
        totalSteps: composition.steps.length,
        status: stepStatus,
        durationMs: stepDuration,
        outputs: stepOutputs,
      })

      // 10. Abort on required step failure
      if (stepStatus === 'failed' && !step.isOptional) {
        return {
          compositionId: composition.id,
          compositionVersion: composition.version,
          status: 'failed',
          stepReceipts,
          totalTasksExecuted,
          durationMs: Date.now() - startTime,
          error: receipt.error,
        }
      }
    }

    return {
      compositionId: composition.id,
      compositionVersion: composition.version,
      status: 'completed',
      stepReceipts,
      totalTasksExecuted,
      durationMs: Date.now() - startTime,
    }
  }
}
