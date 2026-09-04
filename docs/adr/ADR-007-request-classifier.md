# ADR-007: Decouple Planning from Chat via RequestClassifier

## Context
In Phase 1, all user messages flowed directly into conversational streaming. In Phase 2, tasks must be converted into execution blueprints without tying planning solely to conversation routes.

## Decision
Introduce a `RequestClassifier` at the entry point of the message handling pipeline. It classifies input into `conversation`, `planning`, or `execution` before dispatching to the appropriate subsystem. A fast heuristic pass evaluates high-signal keywords; ambiguous queries fall back to a zero-temperature LLM classification.

## Consequences
- Planning can be invoked from the unified message input or explicitly via `plan.create`.
- Chat and Planning remain cleanly isolated.
- Execution lifecycle commands in Phase 3 can be intercepted at the router level.
