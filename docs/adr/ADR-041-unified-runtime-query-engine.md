# ADR-041: Unified Runtime Query API

## Status
Accepted

## Context
Exposing separate retrieval APIs for documents, observations, browser graphs, snapshots, and execution history creates fragmented client integrations across the Planner, UI, Services, and Replay engines.

## Decision
We expose a single, cohesive interface: `RuntimeQueryEngine`:
- `query()`: General multi-domain context query returning a compiled `RuntimeContextBundle`.
- `search()`: Hybrid search across indexed local assets.
- `lookup()`: Direct key/URI lookup across persistent knowledge.
- `observe()`: Latest state observations for a subsystem or target.
- `history()`: Historical snapshots and session states.
- `graph()`: Domain navigation and page hierarchy queries.
- `documents()`: Parsed document and table lookups.
- `executions()`: Execution memory and workflow pattern retrieval.

All internal consumers (Planner, Desktop UI, Replay, Services) interact exclusively with `RuntimeQueryEngine`.

## Consequences
- Single access point simplifies security audits, query logging, and caching.
- Seamless future plugin and sidecar extensibility.
