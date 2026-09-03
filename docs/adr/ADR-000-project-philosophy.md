# ADR-000: Project Philosophy & Design Principles

## Status
Accepted

## Context
usePilot is envisioned as a desktop assistant that executes tasks autonomously while respecting user privacy and local-first execution.

## Decision
1. **Local-First**: All conversation history, user preferences, and sensitive data remain strictly on the host device within SQLite.
2. **Zero Involuntary Cloud Egress**: Only outbound AI API calls requested explicitly by the user occur; telemetry is disabled or strictly opt-in.
3. **No Overengineering**: Phase 1 establishes the production-grade foundation (clean separation of concerns, strict typing, streaming UI) without premature complexity for future phases.
