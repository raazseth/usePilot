# ADR-022: Execution Policy Engine

## Context
Previously, runtime policies (concurrency ceiling, retry attempts and backoffs, approval enforcement, verification rigor, and task timeouts) were either hardcoded or scattered across independent components (`RetryEngine`, `VerificationEngine`, `ApprovalGate`, `TaskScheduler`). Modifying execution behavior required touching code across multiple modules.

## Decision
Introduce `ExecutionPolicyEngine` as the single authoritative policy layer governing runtime decisions:
1. `ExecutionPolicy` defines a unified configuration contract:
   - `maxParallelism`: batch concurrency limit
   - `retry`: maximum attempts, initial/max backoff, multiplier, retryable failure categories
   - `approval`: enforcement mode (`strict`, `default`, `permissive`) and timeout
   - `verification`: verification level (`strict`, `standard`, `best_effort`) and fail-fast behavior
   - `timeout`: default task timeout and run timeout
   - `adapter`: preferred adapters and session scoping
2. `ExecutionRunner` and its sub-engines (`RetryEngine`, `ApprovalGate`, `TaskScheduler`, `VerificationEngine`) query `ExecutionPolicyEngine` rather than making ad-hoc policy decisions.
3. Safe defaults are provided via `createDefaultExecutionPolicy()`.

## Consequences
- Centralizes all execution behavior and operational knobs into a single observable structure.
- Allows test runs, headless runs, or strict environments to override policies cleanly without altering runtime engine logic.
- The active policy is captured in snapshots and serialized into the final execution manifest.
