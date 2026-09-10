# Retry Engine

The `RetryEngine` implements infrastructure-level retries without adapters needing bespoke retry logic. It couples adapter execution with post-execution verification to ensure retries happen when either execution or verification fails.

## Architecture & Flow

```text
Attempt Loop (1 .. maxAttempts)
      │
      ├── 1. Check ctx.signal.aborted (abort if cancelled)
      ├── 2. Dispatch via AdapterSandbox (or IAdapterSession)
      ├── 3. VerificationEngine.verify(task, result, blueprint)
      │      └── If (result.success && verification.passed) ──► Return SUCCESS
      │
      ├── 4. PolicyEngine.shouldRetry(task, attempt, failureCategory)
      │      └── If false or attempts exhausted ──► Return FAILURE
      │
      └── 5. PolicyEngine.getRetryBackoffMs(attempt) ──► Delay ──► Next Attempt
```

## Configuration & Policy Coordination

Retry behavior is governed by the `ExecutionPolicyEngine`, with fallback to the task's blueprint settings:
- **`maxAttempts`**: Maximum execution attempts (default: 3).
- **`initialBackoffMs`**: Base delay before first retry (default: 500ms).
- **`maxBackoffMs`**: Maximum backoff cap (default: 10,000ms).
- **`backoffMultiplier`**: Exponential backoff multiplier (default: 2.0).
- **`retryableCategories`**: Explicit failure categories eligible for retry (`'adapter_failure'`, `'timeout'`, `'resource_failure'`, `'verification_failure'`).

## Cooperative Cancellation

The retry loop checks `ctx.signal.aborted` before every attempt and during backoff delay. If cancelled, retry attempts abort immediately with `failureCategory: 'cancellation'`.

