# usePilot Documentation Index

Welcome to the usePilot architectural and technical documentation. This directory provides exhaustive, authoritative engineering documentation for every subsystem, data model, runtime adapter, and architectural decision.

---

## 1. What is this?

This documentation suite serves as the complete technical specification for usePilot, a local-first, deterministic desktop AI assistant built on Tauri, Bun, TypeScript, and SQLite.

The documentation is organized into three major layers:
1. **System Architecture & Governance**: Global topologies, lifecycle invariants, sequences, ADRs, and public API surfaces.
2. **Core Pipelines**: The 14-stage cognitive Planner and the deterministic state-machine Execution engine.
3. **Runtime Subsystems**: Operating memory, perception engines, hardware adapters, sandboxes, and safety controls.

---

## 2. Documentation Structure

```
docs/
├── architecture/          # Global topologies, ownership matrix, sequence diagrams, API reference
├── adr/                   # 47 Architectural Decision Records & master dependency network
├── planner/               # 14-stage cognitive planning pipeline & validation models
├── execution/             # Deterministic state machine, capability adapters, verification, journaling
│
├── runtime-context/       # Tiered operating memory (Hot/Warm/Cold) & unified facade
├── observations/          # Ring-buffered perception feeds (browser, filesystem, desktop)
├── knowledge-store/       # Domain facts, operational rules, and persistent entity cache
├── runtime-index/         # Embedded hybrid search engine (BM25 + offline vector embeddings)
├── browser-graph/         # Domain navigation topologies, form schemas, and element locators
├── replay/                # Step-by-step forensic execution replay and diff generation
│
├── browser/               # Playwright browser automation adapter & multi-tab session pool
├── filesystem/            # Sandboxed atomic filesystem I/O operations & path confinement
├── desktop/               # OS clipboard, window management, and native process supervisor
├── vision/                # Visual assertions, screenshot matching, and OCR pipeline
│
├── verification/          # Independent postcondition assertion engine & deterministic checks
├── self-healing/          # 4-stage cascading locator repair without LLM hallucination
├── permissions/           # Granular permission scoping, authorization grants, and rate limits
├── secrets/               # AES-256-GCM encrypted secret vault & memory zeroization
├── artifacts/             # Large binary artifact disk store with SHA-256 deduplication
│
├── diagnostics/           # Resource leak detection, file descriptor tracking, process trees
├── health/                # Subsystem health telemetry, heartbeat checks, latency histograms
├── tracing/               # Structured spans, causal trace propagation, and timeline indexing
└── performance/           # Memory thresholds, GC triggers, and performance budgets
```

---

## 3. Subsystem Directory Map

| Subsystem | Scope & Ownership | Primary Entrypoint | Key ADR |
|---|---|---|---|
| [Architecture](architecture/README.md) | Global topologies, ownership matrix, lifecycle invariants, sequences | [overview.md](architecture/overview.md) | [ADR-001](adr/ADR-001-bun-sidecar.md)–[ADR-006](adr/ADR-006-package-boundaries.md) |
| [ADRs](adr/README.md) | 47 Architectural Decision Records with dependency graph | [adr/README.md](adr/README.md) | [ADR-000](adr/ADR-000-project-philosophy.md) |
| [Planner](planner/README.md) | Intent routing, task graph generation, validation, Kahn DAG ordering | [planner-overview.md](planner/planner-overview.md) | [ADR-007](adr/ADR-007-request-classifier.md)–[ADR-012](adr/ADR-012-plan-optimizer.md) |
| [Execution](execution/README.md) | Deterministic runner, capability negotiation, sandboxing, journal | [execution-overview.md](execution/execution-overview.md) | [ADR-013](adr/ADR-013-execution-runtime.md)–[ADR-023](adr/ADR-023-execution-manifest.md) |
| [Runtime Context](runtime-context/README.md) | Operating memory, 3-tier storage facade, atomic transactions | [RuntimeContextFacade](runtime-context/README.md) | [ADR-045](adr/ADR-045-runtime-context-facade-and-tiered-storage.md) |
| [Browser](browser/README.md) | Playwright engine, page pool, session lifecycle | `PlaywrightBrowserAdapter` | [ADR-024](adr/ADR-024-browser-runtime.md) |
| [Filesystem](filesystem/README.md) | Path confinement, atomic writes, recursive file tree walks | `NativeFilesystemAdapter` | [ADR-025](adr/ADR-025-native-filesystem-runtime.md) |
| [Desktop](desktop/README.md) | Clipboard operations, window management, process supervision | `NativeDesktopAdapter` | [ADR-026](adr/ADR-026-native-desktop-runtime.md) |
| [Vision](vision/README.md) | Screenshot capture, template matching, OCR text extraction | `VisionSubsystem` | [ADR-027](adr/ADR-027-vision-runtime.md) |
| [Verification](verification/README.md) | Postcondition assertions, exit code validation, DOM checks | `VerificationEngine` | [ADR-018](adr/ADR-018-verification-model.md) |
| [Self-Healing](self-healing/README.md) | 4-stage algorithmic locator repair cascade (`dom → semantic → visual → ocr`) | `SelfHealingPipeline` | [ADR-028](adr/ADR-028-deterministic-self-healing.md) |
| [Permissions](permissions/README.md) | Capability-based security grants, path restrictions, rate limits | `PermissionManager` | [ADR-030](adr/ADR-030-permission-manager.md) |
| [Secrets](secrets/README.md) | AES-256-GCM vault, key derivation, memory zeroization | `SecretVault` | [ADR-029](adr/ADR-029-secure-secret-vault.md) |
| [Artifacts](artifacts/README.md) | Binary blob storage, SHA-256 deduplication, lifecycle retention | `ArtifactStore` | [ADR-031](adr/ADR-031-runtime-artifact-store.md) |
| [Diagnostics](diagnostics/README.md) | Resource leak detection, file handle audits, process monitor | `RuntimeDiagnostics` | [ADR-036](adr/ADR-036-runtime-diagnostics.md) |
| [Health](health/README.md) | Subsystem health status, heartbeat probes, latency tracking | `HealthMonitor` | [ADR-033](adr/ADR-033-runtime-health-monitoring.md) |
| [Tracing](tracing/README.md) | Span creation, causal trace context propagation, timeline builder | `TracingSubsystem` | [ADR-032](adr/ADR-032-browser-trace-recording.md) |
| [Performance](performance/README.md) | Memory thresholds, latency budgets, GC pressure management | `PerformanceMonitor` | [ADR-033](adr/ADR-033-runtime-health-monitoring.md) |
| [Observations](observations/README.md) | Ring-buffered perception log, sensory event distribution | `ObservationEngine` | [ADR-038](adr/ADR-038-observation-model.md) |
| [Knowledge Store](knowledge-store/README.md) | Domain facts, operational rules, entity caching | `KnowledgeStore` | [ADR-039](adr/ADR-039-knowledge-store.md) |
| [Browser Graph](browser-graph/README.md) | Web domain navigation routes, form fields, action topology | `BrowserKnowledgeGraph` | [ADR-040](adr/ADR-040-browser-knowledge-graph.md) |
| [Runtime Index](runtime-index/README.md) | Hybrid local search (BM25 + offline vector indexing) | `RuntimeIndexEngine` | [ADR-041](adr/ADR-041-unified-runtime-query-engine.md) |
| [Replay](replay/README.md) | Forensic execution reconstruction from SQLite journal | `ExecutionReplayEngine` | [ADR-034](adr/ADR-034-execution-replay.md) |

---

## 4. Where should I go next?

1. **System Overview**: Start with [Architecture Overview](architecture/overview.md) to understand process boundaries between Tauri, Bun, and the frontend.
2. **Object Ownership**: Review [Ownership & Lifecycle Matrix](architecture/ownership-matrix.md) to see mutation rules and storage tiers for every entity.
3. **Execution Sequences**: Review [Sequence Diagrams](architecture/sequence-diagrams.md) to trace step-by-step execution, approval gates, and self-healing.
4. **Public APIs**: Consult [Public API Reference & Parity Matrix](architecture/public-api-reference.md) for code samples, exported interfaces, and anti-patterns.
5. **Architectural Decisions**: Consult the [ADR Index](adr/README.md) for decision rationales and alternatives considered.
