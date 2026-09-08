# ADR-028: Deterministic 5-Stage Self-Healing Cascade (Zero LLM)

## Context
Websites and applications update their UI layouts, button labels, and DOM structure continuously. Traditional robotic process automation breaks whenever an ID or class name changes. While LLM-based healing is trendy, it introduces latency, cost, privacy leaks, and non-deterministic behavior during mission-critical execution.

## Decision
Implement `SelfHealingPipeline` with a strictly deterministic, 5-stage cascade:
1. **Stage 1: DOM Fallback**: Evaluates alternative attributes (`aria-label`, `name`, `placeholder`, `role`, `data-testid`).
2. **Stage 2: Semantic Lookup**: Traverses the DOM tree for visible textual matches and accessible tree roles (`getByRole`, `getByText`).
3. **Stage 3: Visual Template Matching**: Compares reference element template images against full-page screenshots to resolve target coordinates.
4. **Stage 4: OCR Lookup**: Performs local OCR across the viewport image to detect localized text matching the desired action.
5. **Stage 5: Backoff Retry**: Applies exponential jittered retry before safely failing the task.

Zero LLMs participate in this loop. Every recovery attempt is immutably logged into the `ExecutionJournal` with stage, method, duration, and outcome.

## Consequences
- Highly resilient UI automation that survives website updates and responsive layout variations.
- Guaranteed sub-second recovery times without external token costs or privacy exposure.
- Produces full audit trails of every self-healing adaptation in the cryptographic execution manifest.
