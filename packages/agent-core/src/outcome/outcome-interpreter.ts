import type { AgentExecutionOutcome, AgentOutcomeStatus } from '@usepilot/agent-types'
import type { ComposedExecutionReceipt } from '@usepilot/skill-types'

/**
 * AgentOutcomeInterpreter — Interprets raw execution receipts and verification reports.
 *
 * Invariant: Verification is authoritative. No model or agent can declare "success"
 * if the underlying SkillVerifier or ExecutionRunner failed.
 */
export class AgentOutcomeInterpreter {
  interpret(
    agentId: string,
    goalId: string,
    receipt: ComposedExecutionReceipt,
    replanCount: number,
    durationMs: number
  ): AgentExecutionOutcome {
    let status: AgentOutcomeStatus = 'SUCCESS'
    let summary = ''
    let userExplanation = ''
    let allVerified = true

    // Check overall status
    if (receipt.status === 'approval_required') {
      return {
        status: 'BLOCKED',
        agentId,
        goalId,
        workflowId: receipt.compositionId,
        executionReceipt: receipt,
        verificationStatus: false,
        summary: `Workflow paused: step "${receipt.pendingApprovalStepId ?? 'unknown'}" requires explicit user approval.`,
        durationMs,
        replanCount,
        userExplanation: 'Execution paused because an action modifies system files or requires high-privilege permissions.',
      }
    }

    if (receipt.status === 'failed') {
      const failedStep = receipt.stepReceipts.find((s) => s.status === 'failed')
      status = 'EXECUTION_FAILURE'
      summary = failedStep
        ? `Execution failed at step "${failedStep.stepId}": ${failedStep.error ?? 'Unknown error'}`
        : `Execution failed: ${receipt.error ?? 'Unknown error'}`
      userExplanation = `The task could not be completed because ${failedStep?.error ?? receipt.error ?? 'a step failed during execution'}.`

      return {
        status,
        agentId,
        goalId,
        workflowId: receipt.compositionId,
        executionReceipt: receipt,
        verificationStatus: false,
        summary,
        durationMs,
        replanCount,
        userExplanation,
      }
    }

    // Examine step verification
    const verifiedSteps = receipt.stepReceipts.filter((s) => s.verified)
    const unverifiedSteps = receipt.stepReceipts.filter((s) => !s.verified && s.status === 'completed')

    if (unverifiedSteps.length > 0) {
      allVerified = false
      status = 'VERIFICATION_FAILURE'
      summary = `Execution completed but verification failed for step(s): ${unverifiedSteps.map((s) => s.stepId).join(', ')}`
      userExplanation = 'Tasks ran, but cryptographic or semantic outcome verification could not be confirmed.'
    } else if (verifiedSteps.length < receipt.stepReceipts.length) {
      status = 'PARTIAL_SUCCESS'
      summary = `Partially completed: ${verifiedSteps.length} of ${receipt.stepReceipts.length} steps succeeded.`
      userExplanation = `Completed ${verifiedSteps.length} step(s), but some non-essential steps were skipped.`
    } else {
      status = 'SUCCESS'
      summary = `All ${receipt.stepReceipts.length} steps completed and cryptographically verified.`
      userExplanation = `Successfully completed all ${receipt.stepReceipts.length} actions with verified outcome.`
    }

    // Aggregate outputs
    const aggregatedOutputs: Record<string, unknown> = {}
    for (const step of receipt.stepReceipts) {
      Object.assign(aggregatedOutputs, step.outputs)
    }

    return {
      status,
      agentId,
      goalId,
      workflowId: receipt.compositionId,
      executionReceipt: receipt,
      verificationStatus: allVerified,
      summary,
      durationMs,
      replanCount,
      userExplanation,
      outputs: aggregatedOutputs,
    }
  }
}
