# System Architecture

usePilot is an autonomous computer-use assistant built on a local-first, deterministic execution runtime. It isolates cognitive reasoning from low-level automation, enforcing strict verification and permission boundaries across browser, desktop, and filesystem environments.

---

## System Topology

```text
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Tauri v2 Desktop                                     │
│                                                                                        │
│   ┌─────────────────────────────────────────┐    ┌──────────────────────────────────┐  │
│   │            React 19 Frontend            │    │         Rust Shell (IPC)         │  │
│   │                                         │    │                                  │  │
│   │  - Streaming Chat & Inspector Panels    │◄──►│  - Native window management      │  │
│   │  - Replay Timeline & Context Graph      │ IPC│  - Dynamic port handshake        │  │
│   │  - Reactive Zustand Store (useAppStore) │    │  - OS shell & tray integration   │  │
│   └────────────────────┬────────────────────┘    └────────────────┬─────────────────┘  │
│                        │                                          │                    │
│                        │ Loopback WebSocket / HTTP                │ Spawns & monitors  │
│                        │ (Dynamic port on 127.0.0.1)              ▼                    │
│                        │                         ┌──────────────────────────────────┐  │
│                        └────────────────────────►│        Bun Backend Sidecar       │  │
│                                                  │                                  │  │
│                                                  │  - HTTP API & EventBus           │  │
│                                                  │  - AI Provider Manager           │  │
│                                                  │  - Execution Coordinator         │  │
│                                                  └──────────────┬───────────────────┘  │
└─────────────────────────────────────────────────────────────────┼──────────────────────┘
                                                                  │
                 ┌────────────────────────────────────────────────┼─────────────────────────────────┐
                 ▼                                                ▼                                 ▼
┌──────────────────────────────────┐    ┌──────────────────────────────────┐    ┌──────────────────────────────────┐
│      @usepilot/planner-core      │    │     @usepilot/execution-core     │    │    @usepilot/runtime-context     │
│                                  │    │                                  │    │                                  │
│  - Request Classifier & Normalizer│   │  - Execution Runner & Scheduler  │    │  - RuntimeContextFacade          │
│  - Goal Extractor & Intent Model │    │  - Capability Registry & Manifest│    │  - Hot Session State Store       │
│  - Task DAG & Critical Path      │    │  - Dependency Graph Evaluator    │    │  - Multi-Tier Knowledge Store    │
│  - 3-Layer Validation Pipeline   │    │  - Browser, FS, Desktop Adapters │    │  - Browser Knowledge Graph       │
│  - Approval Policy Engine        │    │  - Verification Engine           │    │  - Relational Entity Graph       │
│  - Blueprint Serializer          │    │  - Deterministic Self-Healing    │    │  - Hybrid Index (BM25 + Cosine)  │
│                                  │    │  - Secret Vault & Permissions    │    │  - Bounded Observation Engine    │
│                                  │    │  - Timeline & Failure Bundles    │    │  - Observation Replay Engine     │
└────────────────┬─────────────────┘    └────────────────┬─────────────────┘    └────────────────┬─────────────────┘
                 │                                       │                                       │
                 │ Produces Blueprint                    │ Executes & Emits                      │ Queries & Syncs
                 └───────────────────────────────────────┼───────────────────────────────────────┘
                                                         │
                                                         ▼
                                        ┌──────────────────────────────────┐
                                        │        Persistence Layer         │
                                        │                                  │
                                        │  - SQLite (WAL) via Drizzle ORM  │
                                        │  - Content-Addressed Artifacts   │
                                        │  - Immutable Execution Journal   │
                                        │  - Cryptographic Manifests       │
                                        └──────────────────────────────────┘
```

---

## Subsystem Responsibilities

### 1. Presentation Shell (`apps/desktop`)
Renders the user interface via an isolated Webview, displaying streaming chat conversations, interactive task blueprints, real-time browser viewports, context entity graphs, and stepped observation replays. It binds to the backend sidecar over loopback IPC and WebSockets using dynamic port negotiation.

### 2. Backend Orchestrator (`apps/backend`)
Acts as the central coordination hub. It receives user prompts over WebSocket, manages local/remote AI provider endpoints (Ollama, LM Studio, OpenAI-compatible), dispatches planning requests to `@usepilot/planner-core`, forwards validated blueprints to `@usepilot/execution-core`, and streams state transitions back to the desktop UI via a typed `EventBus`.

### 3. Cognitive Planner (`@usepilot/planner-core`)
A purely deterministic reasoning pipeline. It translates natural language goals into a validated, directed acyclic graph (DAG) of atomic tasks (`ExecutionBlueprint`). The planner evaluates environment capabilities, assigns approval requirements (`automatic`, `optional`, `mandatory`, `forbidden`), optimizes sequential steps, and computes SHA-256 fingerprint receipts. It contains zero execution logic and never imports automation drivers.

### 4. Deterministic Execution Runner (`@usepilot/execution-core`)
The execution substrate. It schedules tasks according to DAG dependencies, negotiates concrete capability adapters against platform constraints and immutable `AdapterManifest`s, checks permissions, executes actions through sandboxed drivers (Playwright browser, native filesystem, desktop bridge), evaluates independent postconditions via `VerificationEngine`, and invokes deterministic self-healing when locators mutate.

### 5. Runtime Context Layer (`@usepilot/runtime-context`)
The single source of truth for runtime environment state. Encapsulated behind `RuntimeContextFacade`, it maintains hot session state (active URL, window, paths), multi-tier knowledge (caches, documents, OCR geometries), browser navigation topologies (`BrowserKnowledgeGraph`), bidirectional entity graphs, a local hybrid index (`BM25` + vector cosine), and a rolling 2,000-entry observation stream.

### 6. Persistence & Artifacts (`@usepilot/database` + Artifact Store)
Durable storage backed by SQLite in Write-Ahead Logging (WAL) mode for conversations, execution journals, checkpoints, and settings. Large binary files, screenshots, traces, and DOM dumps are managed by the content-addressed Runtime Artifact Store under canonical `artifact://` URIs.

---

## Architectural Invariants

1. **Separation of Reasoning and Execution**: Planners formulate DAG blueprints; executors run them. The execution loop never calls large language models to decide next steps.
2. **Postcondition Verification**: Task completion requires physical proof (file existence, URL verification, checksum validation), not mere adapter exit codes.
3. **Local-First Privacy**: All conversations, secrets, artifacts, and context indexes remain on the local machine. Remote network calls occur only when explicitly requested by user-configured AI providers or target website automations.
4. **Content-Addressed Immutability**: Blueprints, snapshots, manifests, and artifacts are keyed by deterministic SHA-256 digests, guaranteeing auditability and tamper-resistance.
5. **Single Facade Boundary**: Runtime Context internal storage structures, graph adjacency sets, and indexing engines are strictly private, accessible solely via `RuntimeContextFacade`.

---

## Core Architecture References

- [System Ownership & Lifecycle Matrix](ownership-matrix.md) — Who owns what, mutability rules, and 3-tier storage architecture
- [Runtime Sequence Diagrams](sequence-diagrams.md) — Dynamic execution flow, self-healing cascades, and transaction rollbacks
- [Public API Reference & Parity Matrix](public-api-reference.md) — Exhaustive inventory of all exported symbols, examples, and test coverage
- [Architecture Decision Records (ADRs)](../adr/README.md) — Complete 47-ADR network graph and decision traceability ("Why not X?")
- [Planner Architecture Overview](../planner/planner-overview.md) — 14-stage cognitive planner pipeline
- [Execution Runtime Overview](../execution/execution-overview.md) — Deterministic state machine runner and adapter substrate


