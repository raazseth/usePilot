# ADR-002: DDD-Lite & In-Process Event Bus

## Status
Accepted

## Context
As usePilot supports autonomous planning, browser automation, and multi-step tool calling, coupling routes directly to business logic degrades maintainability.

## Decision
Adopt a DDD-lite structure:
- **Domain Layer**: Core models, events, and repository interfaces.
- **Application Layer**: Explicit Commands and Queries encapsulating business workflows.
- **Infrastructure Layer**: Concrete implementations of HTTP routing, WebSocket event transport, SQLite databases, and AI providers.
- **Internal EventBus**: Decoupled in-memory publish/subscribe event bus where state transitions emit domain events for logging, UI synchronization, and autonomous agents.
