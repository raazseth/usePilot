# ADR-042: Observation Replay & Deterministic Reproduction

## Status
Accepted

## Context
Diagnosing execution failures or regression testing automated workflows requires stepping through the exact perceived state of the computer during past executions without re-triggering destructive actions or external API calls.

## Decision
We implement `ObservationReplayEngine`. Given a sequence of recorded `Observation` objects from an execution run:
- The engine reconstructs stepped state frames.
- Allows forward/backward stepping (`stepForward`, `stepBackward`, `seekTo`).
- Preserves latest known browser URLs, DOM fingerprints, filesystem paths, and verification states up to each step.
- Completely read-only with zero live side-effects.

## Consequences
- Fast, reliable debugging and post-mortem analysis.
- Enables visual stepping directly in the Desktop UI (`/context` History tab).
