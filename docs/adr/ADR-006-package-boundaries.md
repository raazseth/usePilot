# ADR-006: Package Boundaries & Dependency Inversion

## Status
Accepted

## Context
A monorepo with multiple apps and shared libraries can easily devolve into spaghetti code and circular dependencies if strict boundaries and directional flow are not enforced.

## Decision
Enforce a unidirectional, layered dependency graph:

```
apps/desktop (Frontend / Shell)
  └── depends on: @usepilot/types, @usepilot/utils, @usepilot/config

apps/backend (Bun Sidecar)
  ├── depends on: @usepilot/ai-core, @usepilot/ai-providers, @usepilot/database
  └── depends on: @usepilot/types, @usepilot/utils, @usepilot/config

packages/database
  └── depends on: @usepilot/types, @usepilot/utils, @usepilot/config

packages/ai-providers
  ├── depends on: @usepilot/ai-core
  └── depends on: @usepilot/types, @usepilot/utils

packages/ai-core
  └── depends on: @usepilot/types

packages/config
  └── depends on: (no workspace packages - pure zod schema definitions)

packages/utils
  └── depends on: @usepilot/types

packages/types
  └── depends on: (ZERO workspace dependencies - pure TypeScript definitions)
```

## Rules
1. `@usepilot/types` has ZERO runtime dependencies and ZERO workspace dependencies.
2. Packages NEVER import upwards from `apps/*`.
3. Circular dependencies between packages are forbidden and checked via linting/typechecking.
4. Database queries and models are strictly encapsulated within `@usepilot/database` repositories.
