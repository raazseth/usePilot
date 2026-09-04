# ADR-008: Deterministic Input Normalization Before Extraction

## Context
Raw natural language text contains erratic whitespace, relative date references ("tomorrow", "next week"), unformatted entity strings, and varied unicode scripts, which increase LLM token consumption and reduce extraction accuracy.

## Decision
Run a pure-function `Normalizer` before any LLM extraction stage. It performs whitespace collapsing, resolves relative temporal expressions into canonical ISO 8601 dates, and extracts structured entities (URLs, emails, file paths, monetary amounts).

## Consequences
- The LLM receives clean, canonical input.
- Entity extraction is guaranteed deterministic and zero-cost for known syntactic patterns.
- Downstream goal extraction prompt tokens are minimized.
