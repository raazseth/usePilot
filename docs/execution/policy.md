# Execution Policy Engine

The `ExecutionPolicyEngine` acts as the single source of truth for runtime execution parameters, eliminating ad-hoc policy decisions and scattered configuration constants.

## Policy Structure

```typescript
export interface ExecutionPolicy {
  readonly maxParallelism: number
  readonly retry: RetryPolicyConfig
  readonly approval: ApprovalPolicyConfig
  readonly verification: VerificationPolicyConfig
  readonly timeout: TimeoutPolicyConfig
  readonly adapter: AdapterPolicyConfig
}
```

### Policy Sub-Configurations

- **`maxParallelism`**: Integer cap on concurrent task executions (e.g. 1–8).
- **`retry`**:
  - `maxAttempts`: Maximum retry attempts (default: 3).
  - `initialBackoffMs`: Initial delay before first retry (default: 500ms).
  - `maxBackoffMs`: Maximum backoff limit (default: 10,000ms).
  - `backoffMultiplier`: Exponential factor (default: 2.0).
  - `retryableCategories`: Array of failure categories eligible for retry (`'adapter'`, `'timeout'`, `'resource'`, `'verification'`).
- **`approval`**:
  - `mode`: `'strict'` | `'default'` | `'permissive'`.
  - `timeoutMs`: Time allowed for user response before aborting.
- **`verification`**:
  - `level`: `'strict'` | `'standard'` | `'best_effort'`.
  - `failFast`: Boolean indicating whether verification failure immediately halts execution.
- **`timeout`**:
  - `defaultTaskTimeoutMs`: Per-task execution budget (default: 30,000ms).
  - `runTimeoutMs`: Total execution budget (default: 300,000ms).
- **`adapter`**:
  - `preferredAdapters`: Mapping of `TaskCapability` to preferred adapter IDs.
  - `sessionScope`: `'run'` | `'capability'` | `'task'` (default: `'capability'`).

## Interface Contract

```typescript
export interface IExecutionPolicyEngine {
  readonly policy: ExecutionPolicy
  shouldRetry(category: FailureCategory, currentAttempt: number): boolean
  getBackoffMs(attempt: number): number
  getTaskTimeout(task: Task): number
  getMaxParallelism(): number
  shouldVerify(level: 'strict' | 'standard' | 'best_effort'): boolean
  isApprovalRequired(riskLevel: RiskLevel): boolean
  getPreferredAdapter(capability: TaskCapability): string | undefined
  getSessionScope(): SessionScope
}
```

## Defaults & Customization

Safe, deterministic defaults are initialized using `createDefaultExecutionPolicy()`. Individual fields can be overridden when launching an execution run to support headless automated testing, high-throughput batching, or strict human-in-the-loop environments.
