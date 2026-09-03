# ADR-003: WebSocket Streaming & Unified Protocol

## Status
Accepted

## Context
Desktop AI interactions require real-time token-by-token streaming, connection lifecycle resilience, and bidirectional events (e.g. user abort/stop generation).

## Decision
- Use WebSocket connection with a unified `AppEvent` protocol envelope containing `id`, `type`, `timestamp`, and typed `payload`.
- Auto-reconnection with exponential backoff on the frontend client.
- Streaming uses async iterables (`AsyncIterable<StreamChunk>`) on the backend, allowing immediate cancellation when a client sends `message.stop` or disconnects.
