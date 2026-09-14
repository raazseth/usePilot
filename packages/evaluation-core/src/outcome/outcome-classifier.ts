import type {
  ExecutionOutcome,
  FailureCategory,
  UserFeedbackSignal,
} from '@usepilot/evaluation-types'
import type { ComposedExecutionReceipt } from '@usepilot/skill-types'

export interface OutcomeClassificationContext {
  executionId: string
  goalId: string
  agentId: string
  agentVersion: string
  workflowId?: string | undefined
  workflowVersion?: string | undefined
  skillIds?: string[] | undefined
  skillVersions?: Record<string, string> | undefined
  receipt?: ComposedExecutionReceipt | undefined
  durationMs?: number | undefined
  replanCount?: number | undefined
  clarificationRequired?: boolean | undefined
  userFeedback?: UserFeedbackSignal | undefined
  rawError?: Error | string | undefined
}

/**
 * OutcomeClassifier — Translates execution receipts, verification reports,
 * and user feedback into canonical, structured ExecutionOutcome records.
 *
 * Enforces Architectural Invariants:
 * 1. Verification determines truth: execution completed != system success.
 * 2. Statuses are mutually distinct and non-conflicting.
 * 3. Failure causes are mapped into a standardized taxonomy.
 */
export class OutcomeClassifier {
  classify(context: OutcomeClassificationContext): ExecutionOutcome {
    const timestamp = Date.now()
    const id = `outcome-${context.executionId}-${timestamp}`
    const durationMs = context.durationMs ?? (context.receipt?.durationMs ?? 0)
    const replanCount = context.replanCount ?? 0
    const artifacts: string[] = []
    let trustReceipt: string | undefined = undefined

    const skillIds = context.skillIds ? [...context.skillIds] : []
    const skillVersions = context.skillVersions ? { ...context.skillVersions } : {}

    if (context.receipt) {
      if (!context.workflowId && context.receipt.compositionId) {
        context.workflowId = context.receipt.compositionId
      }
      for (const step of context.receipt.stepReceipts) {
        if (step.skillId && !skillIds.includes(step.skillId)) {
          skillIds.push(step.skillId)
        }
        if (Array.isArray(step.outputs?.['artifacts'])) {
          artifacts.push(...(step.outputs['artifacts'] as string[]))
        }
        if (step.outputs?.['trustReceipt'] && !trustReceipt) {
          const tr = step.outputs['trustReceipt']
          trustReceipt = typeof tr === 'object' && tr !== null && 'hash' in tr ? String((tr as { hash: unknown }).hash) : String(tr)
        }
      }
    }

    // 1. User rejection check
    if (context.userFeedback?.type === 'REJECTION') {
      return {
        id,
        executionId: context.executionId,
        goalId: context.goalId,
        agentId: context.agentId,
        agentVersion: context.agentVersion,
        workflowId: context.workflowId,
        workflowVersion: context.workflowVersion,
        skillIds,
        skillVersions,
        status: 'USER_REJECTED',
        verificationStatus: false,
        failureCategory: 'USER_INPUT',
        failureReason: context.userFeedback.rejectedReason ?? 'Rejected by user',
        durationMs,
        retryCount: this.calculateRetries(context.receipt),
        replanCount,
        userRejection: context.userFeedback.rejectedReason ?? 'Rejected by user',
        artifacts,
        trustReceipt,
        timestamp,
      }
    }

    // 2. User correction check
    if (context.userFeedback?.type === 'CORRECTION') {
      return {
        id,
        executionId: context.executionId,
        goalId: context.goalId,
        agentId: context.agentId,
        agentVersion: context.agentVersion,
        workflowId: context.workflowId,
        workflowVersion: context.workflowVersion,
        skillIds,
        skillVersions,
        status: 'USER_CORRECTED',
        verificationStatus: true,
        durationMs,
        retryCount: this.calculateRetries(context.receipt),
        replanCount,
        userCorrection: context.userFeedback.correctedValue ?? 'User corrected parameter/strategy',
        artifacts,
        trustReceipt,
        timestamp,
      }
    }

    // 3. Clarification boundary check
    if (context.clarificationRequired) {
      return {
        id,
        executionId: context.executionId,
        goalId: context.goalId,
        agentId: context.agentId,
        agentVersion: context.agentVersion,
        workflowId: context.workflowId,
        workflowVersion: context.workflowVersion,
        skillIds,
        skillVersions,
        status: 'CLARIFICATION_REQUIRED',
        verificationStatus: false,
        failureCategory: 'GOAL_UNDERSTANDING',
        failureReason: 'Required parameters or target specifications are missing from user request',
        durationMs,
        retryCount: 0,
        replanCount,
        artifacts,
        trustReceipt,
        timestamp,
      }
    }

    // 4. Blocked approval check
    if (context.receipt?.status === 'approval_required') {
      return {
        id,
        executionId: context.executionId,
        goalId: context.goalId,
        agentId: context.agentId,
        agentVersion: context.agentVersion,
        workflowId: context.workflowId,
        workflowVersion: context.workflowVersion,
        skillIds,
        skillVersions,
        status: 'BLOCKED',
        verificationStatus: false,
        failureCategory: 'PERMISSION',
        failureReason: `Blocked awaiting user approval for step: ${context.receipt.pendingApprovalStepId ?? 'unknown'}`,
        durationMs,
        retryCount: this.calculateRetries(context.receipt),
        replanCount,
        artifacts,
        trustReceipt,
        timestamp,
      }
    }

    // 5. Execution failure check
    if (context.receipt?.status === 'failed' || context.rawError) {
      const failedStep = context.receipt?.stepReceipts.find((s) => s.status === 'failed')
      const errorMessage =
        failedStep?.error ??
        context.receipt?.error ??
        (context.rawError instanceof Error ? context.rawError.message : String(context.rawError ?? 'Unknown execution failure'))

      const category = this.categorizeFailure(errorMessage, failedStep?.skillId)

      return {
        id,
        executionId: context.executionId,
        goalId: context.goalId,
        agentId: context.agentId,
        agentVersion: context.agentVersion,
        workflowId: context.workflowId,
        workflowVersion: context.workflowVersion,
        skillIds,
        skillVersions,
        status: 'FAILED',
        verificationStatus: false,
        failureCategory: category,
        failureReason: errorMessage,
        durationMs,
        retryCount: this.calculateRetries(context.receipt),
        replanCount,
        artifacts,
        trustReceipt,
        timestamp,
      }
    }

    // 6. Verification check (CRITICAL: Execution success != Verification success)
    if (context.receipt) {
      const unverifiedSteps = context.receipt.stepReceipts.filter(
        (s) => !s.verified && s.status === 'completed'
      )
      const verifiedSteps = context.receipt.stepReceipts.filter((s) => s.verified)

      if (unverifiedSteps.length > 0) {
        return {
          id,
          executionId: context.executionId,
          goalId: context.goalId,
          agentId: context.agentId,
          agentVersion: context.agentVersion,
          workflowId: context.workflowId,
          workflowVersion: context.workflowVersion,
          skillIds,
          skillVersions,
          status: 'VERIFICATION_FAILURE',
          verificationStatus: false,
          failureCategory: 'VERIFICATION',
          failureReason: `Execution completed but verification failed for step(s): ${unverifiedSteps.map((s) => s.stepId).join(', ')}`,
          durationMs,
          retryCount: this.calculateRetries(context.receipt),
          replanCount,
          artifacts,
          trustReceipt,
          timestamp,
        }
      }

      if (verifiedSteps.length < context.receipt.stepReceipts.length) {
        return {
          id,
          executionId: context.executionId,
          goalId: context.goalId,
          agentId: context.agentId,
          agentVersion: context.agentVersion,
          workflowId: context.workflowId,
          workflowVersion: context.workflowVersion,
          skillIds,
          skillVersions,
          status: 'PARTIAL_SUCCESS',
          verificationStatus: true,
          durationMs,
          retryCount: this.calculateRetries(context.receipt),
          replanCount,
          artifacts,
          trustReceipt,
          timestamp,
        }
      }
    }

    // 7. Verified Success
    return {
      id,
      executionId: context.executionId,
      goalId: context.goalId,
      agentId: context.agentId,
      agentVersion: context.agentVersion,
      workflowId: context.workflowId,
      workflowVersion: context.workflowVersion,
      skillIds,
      skillVersions,
      status: 'SUCCESS',
      verificationStatus: true,
      durationMs,
      retryCount: this.calculateRetries(context.receipt),
      replanCount,
      userSatisfaction: context.userFeedback?.type === 'SATISFACTION' ? 'SATISFIED' : undefined,
      artifacts,
      trustReceipt,
      timestamp,
    }
  }

  categorizeFailure(errorMessage: string, skillId?: string): FailureCategory {
    const msg = errorMessage.toLowerCase()

    if (msg.includes('auth') || msg.includes('login') || msg.includes('session expired') || msg.includes('unauthorized') || msg.includes('401')) {
      return 'AUTHENTICATION'
    }
    if (msg.includes('permission') || msg.includes('access denied') || msg.includes('forbidden') || msg.includes('policy') || msg.includes('403')) {
      return 'PERMISSION'
    }
    if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('deadline exceeded')) {
      return 'TIMEOUT'
    }
    if (msg.includes('enoent') || msg.includes('file not found') || msg.includes('directory not found') || msg.includes('path does not exist')) {
      return 'FILESYSTEM'
    }
    if (msg.includes('net::') || msg.includes('econnrefused') || msg.includes('enotfound') || msg.includes('network')) {
      return 'NETWORK'
    }
    if (msg.includes('browser') || msg.includes('dom') || msg.includes('selector') || msg.includes('page crashed') || msg.includes('navigation')) {
      return 'BROWSER'
    }
    if (msg.includes('desktop') || msg.includes('window') || msg.includes('display') || msg.includes('bounds')) {
      return 'DESKTOP'
    }
    if (msg.includes('verify') || msg.includes('checksum') || msg.includes('hash mismatch') || msg.includes('verification failed')) {
      return 'VERIFICATION'
    }
    if (msg.includes('parameter') || msg.includes('argument') || msg.includes('missing required')) {
      return 'PARAMETER'
    }
    if (msg.includes('prompt') || msg.includes('injection') || msg.includes('ignore previous')) {
      return 'EXTERNAL_CONTENT'
    }

    if (skillId) {
      if (skillId.includes('browser') || skillId.includes('web')) return 'BROWSER'
      if (skillId.includes('file') || skillId.includes('download') || skillId.includes('organize')) return 'FILESYSTEM'
      if (skillId.includes('desktop') || skillId.includes('window')) return 'DESKTOP'
    }

    return 'RUNTIME'
  }

  private calculateRetries(receipt?: ComposedExecutionReceipt): number {
    if (!receipt) return 0
    return receipt.stepReceipts.reduce((acc, step) => {
      const retries = typeof step.outputs?.['retryCount'] === 'number' ? step.outputs['retryCount'] : 0
      return acc + retries
    }, 0)
  }
}
