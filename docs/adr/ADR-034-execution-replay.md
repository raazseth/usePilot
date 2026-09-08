# ADR-034: Read-Only Execution Replay Engine

## Context
Auditing an AI agent's actions or validating what occurred during an overnight run usually requires running the workflow again, which can trigger duplicate side-effects (e.g. submitting payments, resending messages, re-downloading files).

## Decision
Implement `ExecutionReplayEngine`:
1. **Strictly Read-Only**: Replay reconstructs the execution purely from immutable journal entries, captured screenshots, and artifacts. Zero live commands or network queries are executed.
2. **Step-Through Timeline**: Frames allow users to scrub back and forth through every decision, adapter selection, self-healing attempt, and verification result.
3. **Contextual Artifact Binding**: Directly presents the exact screenshot, DOM state, or downloaded document corresponding to each discrete step.

## Consequences
- 100% safe, idempotent execution inspection.
- Provides complete trust and visibility for compliance, verification, and debugging.
