# ADR-014: Capability-Based Dynamic Adapter Registry

## Context
Tying tasks directly to concrete technologies (e.g. Playwright, specific shell wrappers) makes plans brittle across platforms and hinders adapter evolution.

## Decision
Introduce `CapabilityRegistry` to resolve tasks by abstract `TaskCapability` rather than tool names. The registry matches against platform compatibility (`windows`, `macos`, `linux`) and priority.

## Consequences
- Plans remain portable across operating systems and execution engines.
- Phase 3 operates completely with stub adapters while leaving Phase 4 free to register real automation adapters without modifying the planner or runner.
