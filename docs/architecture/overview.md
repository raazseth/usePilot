# usePilot Architecture Overview

usePilot is an autonomous desktop AI assistant built on a privacy-first, local-first foundation.

## System Topology

```
┌──────────────────────────────────────────────────────────────────┐
│                         Tauri v2 Desktop                         │
│                                                                  │
│  ┌───────────────────────────┐      ┌─────────────────────────┐  │
│  │     React 19 Frontend     │      │     Rust Shell (IPC)    │  │
│  │                           │      │                         │  │
│  │  - Design Tokens & Theme  │◄────►│  - Port allocation      │  │
│  │  - Streaming Chat UI      │ Typed│  - Window management    │  │
│  │  - Conversation Search    │ IPC  │  - OS integration       │  │
│  │  - Settings & Providers   │      └────────────┬────────────┘  │
│  └─────────────┬─────────────┘                   │ Spawns &      │
│                │                                 │ Manages       │
│                │ WebSocket / HTTP                ▼               │
│                │ (Dynamically bound port)   ┌─────────┐          │
│                └───────────────────────────►│ Bun     │          │
│                                             │ Sidecar │          │
│                                             └────┬────┘          │
└──────────────────────────────────────────────────┼───────────────┘
                                                   │
                                                   ▼
                                         ┌───────────────────┐
                                         │   SQLite (WAL)    │
                                         │  + Drizzle ORM    │
                                         │  + AI Providers   │
                                         └───────────────────┘
```

## Architectural Tenets

1. **Local-First & Private by Default**: All conversations, settings, and state are stored in a local SQLite database on the user's computer.
2. **Domain-Driven Design (DDD-Lite)**: Clear separation between:
   - **Domain**: Pure business models, types, and events.
   - **Application**: Command and query handlers executing business use cases.
   - **Infrastructure**: Concrete adapters (Bun HTTP/WS server, Drizzle SQLite, AI provider HTTP clients).
3. **Decoupled Event Bus**: Internal typed `EventBus` enables cross-cutting concerns (logging, UI notifications, future planning engines) to listen to domain events without direct coupling.
4. **Unified Protocol**: WebSocket streaming uses a unified event envelope (`AppEvent`) with discriminated union types for type safety.
5. **Provider Agnostic**: The `AIProvider` interface abstracts Ollama, LM Studio, and OpenAI-compatible endpoints behind a standard contract.
