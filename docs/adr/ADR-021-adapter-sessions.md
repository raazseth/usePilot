# ADR-021: Adapter Session Model and Stateful Execution Reuse

## Context
In previous revisions, adapters were instantiated, initialized, and disposed on every individual task. For stateful environments (browser instances, persistent CLI shells, authenticated HTTP sessions, filesystem handles), tearing down and recreating process context on every atomic task produces massive latency and wipes out shared state (cookies, active working directories, session tokens).

## Decision
Introduce the **Adapter Session Model**:
1. `AdapterSession` encapsulates an initialized adapter instance alongside its operational state, lifecycle metrics (`tasksExecuted`, `errorCount`, `lastActiveAt`), and recovery capabilities (`recover()`).
2. `SessionManager` pools active sessions across tasks within configurable scopes (`capability`, `run`, or `task`).
3. Consecutive tasks requiring the same capability or runtime context request an active session from `SessionManager` rather than creating raw adapters directly.
4. When a session encounters an error or panic, `session.recover()` attempts non-destructive cleanup and re-initialization before recycling the session.
5. All sessions are deterministically disposed via `sessionManager.closeAll()` at the end of the execution run.

## Consequences
- Enables state persistence (e.g. login cookies, navigation history, terminal environment) across multiple sequential tasks.
- Eliminates redundant process startup overhead between related tasks.
- Isolates session lifecycle from core state transitions and failure strategies.
