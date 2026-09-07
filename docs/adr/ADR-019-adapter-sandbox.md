# ADR-019: Adapter Sandbox and Isolation Boundary

## Context
Execution adapters interact with third-party tools, system shells, file systems, and networks. Unhandled exceptions, sync/async panics, and runaway execution loops could crash the engine or hang the scheduler indefinitely.

## Decision
All adapter invocations are executed exclusively through the `AdapterSandbox`. The sandbox wraps adapter execution in a defensive envelope that:
1. Enforces strict task-level timeouts via `AbortController` / `CancellationToken`.
2. Intercepts and recovers both synchronous throws and asynchronous promise rejections.
3. Captures output logs (`stdout`, `stderr`, `system`) per execution attempt.
4. Guarantees deterministic resource disposal by calling `adapter.cleanup()` and `adapter.dispose()` in a `finally` block regardless of execution outcome.

## Consequences
- The execution runtime remains resilient against buggy or misbehaving adapters.
- Resource leaks are prevented across retry cycles and cancelled executions.
- Granular execution telemetry is collected per attempt without polluting the core state machine.
