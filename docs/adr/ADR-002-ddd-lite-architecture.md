# ADR-002: DDD-Lite & In-Process Event Bus

## Status
Accepted

## Context
As usePilot evolves to support autonomous planning, browser automation, and multi-step tool calling (Phases 2-5), coupling routes directly to business logic will degrade maintainability.

## Decision
Adopt a DDD-lite structure:
- **Domain Layer**: Core models, events, and repository interfaces.
- **Application Layer**: Explicit Commands and Queries encapsulating business workflows.
- **Infrastructure Layer**: Concrete implementations of HTTP routing, WebSocket event transport, SQLite databases, and AI providers.
- **Internal EventBus**: Decoupled in-memory publish/subscribe event bus where state transitions emit domain events for logging, UI synchronization, and future autonomous agents.
