// ExecutionPolicyEngine — centralized execution policy decisions

import type {
  ExecutionPolicy,
  IExecutionPolicyEngine,
  FailureCategory,
  VerificationLevel,
  SessionScope,
} from '@usepilot/execution-types'
import type { Task, TaskCapability } from '@usepilot/planner-types'

export function createDefaultExecutionPolicy(overrides?: Partial<ExecutionPolicy>): ExecutionPolicy {
  return {
    maxParallelism: overrides?.maxParallelism ?? 4,
    retry: {
      maxAttempts: 3,
      initialBackoffMs: 500,
      maxBackoffMs: 5000,
      backoffMultiplier: 2,
      retryableCategories: ['adapter_failure', 'timeout', 'verification_failure'],
      ...overrides?.retry,
    },
    approval: {
      enforcement: 'default',
      timeoutMs: 5 * 60 * 1000,
      ...overrides?.approval,
    },
    verification: {
      defaultLevel: 'standard',
      failFast: false,
      ...overrides?.verification,
    },
    timeout: {
      defaultTaskTimeoutMs: 60000,
      ...overrides?.timeout,
    },
    adapter: {
      sessionScope: 'capability',
      ...overrides?.adapter,
    },
  }
}

export class ExecutionPolicyEngine implements IExecutionPolicyEngine {
  readonly policy: ExecutionPolicy

  constructor(policyOverrides?: Partial<ExecutionPolicy>) {
    this.policy = createDefaultExecutionPolicy(policyOverrides)
  }

  shouldRetry(task: Task, attempt: number, category: FailureCategory): boolean {
    if (attempt >= this.policy.retry.maxAttempts) {
      return false
    }

    // Never retry explicit cancellations or access denials
    if (category === 'cancellation' || category === 'approval_denied') {
      return false
    }

    return this.policy.retry.retryableCategories.includes(category)
  }

  getRetryBackoffMs(attempt: number): number {
    const rawBackoff =
      this.policy.retry.initialBackoffMs *
      Math.pow(this.policy.retry.backoffMultiplier, Math.max(0, attempt - 1))
    return Math.min(rawBackoff, this.policy.retry.maxBackoffMs)
  }

  getVerificationLevel(task: Task): VerificationLevel {
    // Priority: task-level complexity or metadata > policy default
    if (task.complexity === 'high') {
      return 'strict'
    }
    return this.policy.verification.defaultLevel
  }

  getTaskTimeout(task: Task): number {
    return this.policy.timeout.defaultTaskTimeoutMs
  }

  getApprovalRequirement(task: Task): { required: boolean; reason?: string | undefined } {
    const policy = task.approvalPolicy ?? 'automatic'

    if (policy === 'forbidden') {
      return { required: false }
    }

    if (policy === 'mandatory') {
      return {
        required: true,
        reason: task.approvalReason ?? 'Mandatory task approval required by plan',
      }
    }

    if (this.policy.approval.enforcement === 'strict' && policy === 'optional') {
      return {
        required: true,
        reason: task.approvalReason ?? 'Optional approval enforced by strict policy',
      }
    }

    return { required: false }
  }

  getMaxParallelism(): number {
    return Math.max(1, this.policy.maxParallelism)
  }

  getPreferredAdapter(capability: TaskCapability): string | undefined {
    return this.policy.adapter.preferredAdapters?.[capability]
  }

  getSessionScope(capability: TaskCapability): SessionScope {
    return this.policy.adapter.sessionScope ?? 'capability'
  }
}
