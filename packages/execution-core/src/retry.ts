// RetryEngine — infrastructure-driven retry, independent of adapters

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  VerificationResult,
  IExecutionPolicyEngine,
  IAdapterSession,
} from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'

import { AdapterSandbox } from './sandbox'
import { VerificationEngine } from './verification'

export interface RetryResult {
  adapterResult: AdapterResult
  verificationResult: VerificationResult
  attempts: number
  succeeded: boolean
}

export type RetryEventCallback = (attempt: number, backoffMs: number, taskId: string) => void | Promise<void>

export class RetryEngine {
  private readonly verificationEngine: VerificationEngine
  private readonly sandbox: AdapterSandbox
  private readonly policyEngine?: IExecutionPolicyEngine | undefined

  constructor(
    sandbox?: AdapterSandbox,
    verificationEngine?: VerificationEngine,
    policyEngine?: IExecutionPolicyEngine
  ) {
    this.verificationEngine = verificationEngine ?? new VerificationEngine()
    this.sandbox = sandbox ?? new AdapterSandbox()
    this.policyEngine = policyEngine
  }

  async run(
    task: Task,
    adapterOrSession: ICapabilityAdapter | IAdapterSession,
    ctx: AdapterContext,
    blueprint: ExecutionBlueprint,
    onRetry?: RetryEventCallback
  ): Promise<RetryResult> {
    const maxAttempts = this.policyEngine?.policy.retry.maxAttempts ?? task.retryPolicy.maxAttempts
    const verificationLevel = this.policyEngine?.getVerificationLevel(task) ?? 'standard'
    let lastResult: AdapterResult | null = null
    let lastVerification: VerificationResult | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      if (ctx.signal.aborted) {
        return {
          adapterResult: { success: false, error: 'Cancelled', failureCategory: 'cancellation', durationMs: 0 },
          verificationResult: { passed: false, checkedConditions: [], failedConditions: [], strategy: 'state_check', durationMs: 0 },
          attempts: attempt - 1,
          succeeded: false,
        }
      }

      const sandboxResult =
        'execute' in adapterOrSession && typeof (adapterOrSession as IAdapterSession).recover === 'function'
          ? await (adapterOrSession as IAdapterSession).execute(ctx)
          : await this.sandbox.execute(adapterOrSession as ICapabilityAdapter, ctx)

      lastResult = sandboxResult.adapterResult
      lastVerification = await this.verificationEngine.verify(task, lastResult, blueprint, verificationLevel)

      if (lastResult.success && lastVerification.passed) {
        return { adapterResult: lastResult, verificationResult: lastVerification, attempts: attempt, succeeded: true }
      }

      const failureCategory = lastResult.failureCategory ?? 'adapter_failure'
      const canRetry = this.policyEngine
        ? this.policyEngine.shouldRetry(task, attempt, failureCategory)
        : attempt < maxAttempts

      if (canRetry && attempt < maxAttempts) {
        const delay = this.policyEngine
          ? this.policyEngine.getRetryBackoffMs(attempt)
          : task.retryPolicy.exponential
            ? task.retryPolicy.backoffMs * Math.pow(2, attempt - 1)
            : task.retryPolicy.backoffMs

        await onRetry?.(attempt, delay, task.id)
        await new Promise((r) => setTimeout(r, delay))
      } else {
        break
      }
    }

    return {
      adapterResult: lastResult!,
      verificationResult: lastVerification!,
      attempts: maxAttempts,
      succeeded: false,
    }
  }
}
