// Execution Policy Types

import type { Task, TaskCapability } from '@usepilot/planner-types'
import type { FailureCategory } from './execution'
import type { VerificationLevel } from './verification'
import type { SessionScope } from './session'

export interface RetryPolicyConfig {
  maxAttempts: number
  initialBackoffMs: number
  maxBackoffMs: number
  backoffMultiplier: number
  retryableCategories: FailureCategory[]
}

export interface ApprovalPolicyConfig {
  enforcement: 'strict' | 'default' | 'permissive'
  timeoutMs: number
}

export interface VerificationPolicyConfig {
  defaultLevel: VerificationLevel
  failFast: boolean
}

export interface TimeoutPolicyConfig {
  defaultTaskTimeoutMs: number
  maxRunTimeoutMs?: number | undefined
}

export interface AdapterPolicyConfig {
  preferredAdapters?: Record<string, string> | undefined
  sessionScope?: SessionScope | undefined
}

export interface ExecutionPolicy {
  maxParallelism: number
  retry: RetryPolicyConfig
  approval: ApprovalPolicyConfig
  verification: VerificationPolicyConfig
  timeout: TimeoutPolicyConfig
  adapter: AdapterPolicyConfig
}

export interface IExecutionPolicyEngine {
  readonly policy: ExecutionPolicy
  shouldRetry(task: Task, attempt: number, category: FailureCategory): boolean
  getRetryBackoffMs(attempt: number): number
  getVerificationLevel(task: Task): VerificationLevel
  getTaskTimeout(task: Task): number
  getApprovalRequirement(task: Task): { required: boolean; reason?: string | undefined }
  getMaxParallelism(): number
  getPreferredAdapter(capability: TaskCapability): string | undefined
  getSessionScope(capability: TaskCapability): SessionScope
}
