# ADR-038: State Observation Model & Separation from Events

## Status
Accepted

## Context
Previous systems often intermingled temporal lifecycle events (`TaskStarted`, `TaskCompleted`) with state perceptions (`currentUrl`, `visibleButton`, `clipboardContent`). This created confusion in planning and replay engines regarding what was an occurrence versus what was the actual state of the operating environment.

## Decision
We enforce a strict separation between **Events** and **Observations**:
- **Event**: "Something happened" (temporal point in time, e.g., `TaskStarted`, `VerificationExecuted`).
- **Observation**: "What the computer observed" (state perception, e.g., current URL, DOM fingerprint, interactive buttons, filesystem paths, window title, OCR text).
Adapters never emit raw implementation internals; they emit typed `Observation` records carrying confidence scores and context provenance.

## Consequences
- Clean mental model: Events drive orchestration and journaling; Observations drive context and knowledge.
- Deterministic replay: Replay engines can reproduce exact state perceptions without re-triggering execution logic.
