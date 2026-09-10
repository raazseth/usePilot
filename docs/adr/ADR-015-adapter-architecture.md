# ADR-015: Standardized Adapter Lifecycle Architecture

## Context
Adapters require consistent lifecycle management (resource allocation, execution, verification, cleanup, and disposal) to prevent resource leaks and zombies.

## Decision
Enforce the `ICapabilityAdapter` contract across all capabilities with discrete lifecycle hooks: `initialize()`, `execute()`, `verify()`, `cleanup()`, `dispose()`, and `isAvailable()`.

## Consequences
- Clean lifecycle guarantees: cleanup and disposal are always invoked in `try...finally` blocks.
- Unified cooperative cancellation through `AbortSignal`.
- Testable adapter harnesses with pluggable stubs.

> [!NOTE]
> Per-task adapter lifecycle was subsequently extended by [ADR-019](ADR-019-adapter-sandbox.md) (isolation and panic safety) and [ADR-021](ADR-021-adapter-sessions.md) (stateful session pooling and scoped reuse).

