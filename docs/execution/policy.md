# Execution Policy Engine

The `ExecutionPolicyEngine` acts as the single source of truth for runtime execution parameters, eliminating ad-hoc policy decisions and scattered configuration constants.

## Policy Structure

```typescript
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
```

## Interface Contract

```typescript
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
```

## Policy Configuration Details

- **`maxParallelism`**: Integer cap on concurrent task executions (e.g. 1–8).
- **`retry`**:
  - `maxAttempts`: Maximum retry attempts (default: 3).
  - `initialBackoffMs`: Initial delay before first retry (default: 500ms).
  - `maxBackoffMs`: Maximum backoff limit (default: 10,000ms).
  - `backoffMultiplier`: Exponential factor (default: 2.0).
  - `retryableCategories`: Array of failure categories eligible for retry (`'adapter_failure'`, `'timeout'`, `'resource_failure'`, `'verification_failure'`).
- **`approval`**:
  - `enforcement`: `'strict'` | `'default'` | `'permissive'`.
  - `timeoutMs`: Time allowed for user response before aborting.
- **`verification`**:
  - `defaultLevel`: `'strict'` | `'standard'` | `'best_effort'`.
  - `failFast`: Boolean indicating whether verification failure immediately halts execution.
- **`timeout`**:
  - `defaultTaskTimeoutMs`: Per-task execution budget (default: 30,000ms).
  - `maxRunTimeoutMs`: Total execution budget (default: 300,000ms).
- **`adapter`**:
  - `preferredAdapters`: Mapping of `TaskCapability` to preferred adapter IDs.
  - `sessionScope`: `'run'` | `'capability'` | `'task'` (default: `'capability'`).

## Defaults & Customization

Safe, deterministic defaults are initialized using `createDefaultExecutionPolicy()`. Individual fields can be overridden when launching an execution run to support headless automated testing, high-throughput batching, or strict human-in-the-loop environments.

