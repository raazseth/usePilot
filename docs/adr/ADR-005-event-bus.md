# ADR-005: Typed In-Process Event Bus

## Status
Accepted

## Context
Cross-cutting concerns (audit logging, metrics, notification dispatch, state synchronization) must be decoupled from core application workflows without tight circular imports or sprawling parameter lists.

## Decision
- Implement a strongly-typed in-memory `EventBus` in `apps/backend/src/events/bus.ts`.
- All domain events are defined in `DomainEventMap` with strictly-typed payload contracts.
- Event handlers are invoked concurrently via `Promise.allSettled`, isolating subscriber failures so one failing listener never interrupts other consumers or aborts core operations.
- Support `onAny` wildcard listener for audit logging, request tracing, and telemetry.
