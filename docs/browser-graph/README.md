# Browser Knowledge Graph Subsystem

The **Browser Knowledge Graph Subsystem** maps discovered web application topologies.

## Stored Attributes per Domain
- `rootUrl`: Base URL for the domain.
- `authenticated`: Whether an authenticated session is active.
- `nodes`: Map of relative paths (`/orders`, `/settings`) with:
  - Form field schemas (input names, types, labels, required attributes)
  - Action definitions (button selectors, click actions, download handlers)
  - Auth requirements
  - Visit frequencies

## Planner Querying
The planner queries `queryEngine.graph('amazon.in')` to inspect routes, avoiding redundant exploration steps.
