# ADR-004: Provider Abstraction & Registry

## Status
Accepted

## Context
Users should be able to switch seamlessly between Ollama (default), LM Studio, and generic OpenAI-compatible endpoints without affecting conversation history or UI rendering.

## Decision
- Abstract provider capabilities behind `AIProvider` in `@usepilot/ai-core`.
- Maintain a `ProviderRegistry` in `@usepilot/ai-providers` managing active configurations, health checks, and model listings.
- Standardize on OpenAI SSE and Ollama NDJSON streaming protocols converted into uniform `StreamChunk` events.
