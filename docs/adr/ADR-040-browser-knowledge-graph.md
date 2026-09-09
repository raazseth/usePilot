# ADR-040: Browser Knowledge Graph

## Status
Accepted

## Context
When interacting with multi-page web applications (e.g. Amazon, GitHub, Stripe), repeatedly exploring DOM structures blindly wastes seconds and tokens. The system needs to accumulate structured topological knowledge about websites without exposing Playwright page objects to the planner.

## Decision
We implement `BrowserKnowledgeGraph`. For every domain visited, the graph records:
- Root URL and discovered route paths
- Page hierarchy and titles
- Form fields (types, labels, required flags)
- Page actions (click targets, download triggers, navigation anchors)
- Authentication state requirements
- **Monotonic Graph Version**: Incremented on every topology change (pages, forms, actions, auth)
- **Deterministic SHA-256 Fingerprint**: Verifiable fingerprint computed across paths, forms, and actions
- **Confidence & Staleness Checking**: `isStale(domain, maxAgeMs)` flags graphs whose verification has expired or whose confidence dropped below threshold (e.g. 0.70).

The Planner queries the graph to understand valid routes and actions before formulating execution blueprints, avoiding stale routes.

## Consequences
- Zero Playwright exposure to the planner.
- Version-aware planner: when website topology shifts or staleness is detected, re-exploration is cleanly triggered.
- Exponential speedup on repeated workflows (e.g., invoice downloads, repository checking).
