# ADR-014: Capability-Based Dynamic Adapter Registry

## Context
Tying tasks directly to concrete technologies (e.g. Playwright, specific shell wrappers) makes plans brittle across platforms and hinders adapter evolution.

## Decision
Introduce `CapabilityRegistry` to resolve tasks by abstract `TaskCapability` rather than tool names. The registry matches against platform compatibility (`windows`, `macos`, `linux`) and priority.

## Consequences
- Plans remain portable across operating systems and execution engines.
- The runtime can operate with baseline stub adapters or register specialized automation adapters without modifying the planner or runner.
