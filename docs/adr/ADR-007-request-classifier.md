# ADR-007: Decouple Planning from Chat via RequestClassifier

## Context
User requests encompass conversational dialogue, multi-step planning tasks, and execution lifecycle commands, requiring classification before dispatch.

## Decision
Introduce a `RequestClassifier` at the entry point of the message handling pipeline. It classifies input into `conversation`, `planning`, or `execution` before dispatching to the appropriate subsystem. A fast heuristic pass evaluates high-signal keywords; ambiguous queries fall back to a zero-temperature LLM classification.

## Consequences
- Planning can be invoked from the unified message input or explicitly via `plan.create`.
- Chat and Planning remain cleanly isolated.
- Execution lifecycle commands can be intercepted at the router level.
