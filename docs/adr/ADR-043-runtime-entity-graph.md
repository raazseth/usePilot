# ADR-043: Runtime Entity Graph & Health Monitoring

## Status
Accepted

## Context
Across execution, usePilot accumulates disparate data stores:
- Browser Graph (topological web routes)
- KnowledgeStore (persistent facts & cached assets)
- Runtime Index (semantic inverted index for PDFs, OCR, files)
- Execution Memory (run outcomes and healed parameters)

However, there was no unified relational entity model connecting a website to its generated document, the resulting downloaded file, the execution run, and the downstream verification task. Furthermore, monitoring subsystem operational health (memory usage, stale domains, index size, replay backlog) was fragmented.

## Decision
We implement:
1. `RuntimeEntityGraph`:
   - Typed entities: `User`, `Website`, `Document`, `Window`, `Application`, `File`, `Folder`, `Form`, `Execution`, `Task`, `Adapter`, `Permission`
   - Typed relationships: `opened`, `downloaded`, `generated`, `depends_on`, `belongs_to`, `references`, `created_by`, `verified_by`
   - Bidirectional adjacency indexing (`outgoing`, `incoming`) for rapid path traversal (e.g. `amazon.in` -> `GST Invoice` -> `Downloaded PDF` -> `Execution #42` -> `Verification`).
   - Query engine integration via `RuntimeQueryEngine.entities()` and `RuntimeQueryEngine.entityNeighbors()`.

2. `RuntimeContextHealthMonitor`:
   - Unified telemetry and diagnostic reporting across all 6 core context subsystems:
     - `KnowledgeStore`: Total items, category breakdowns
     - `RuntimeIndex`: Total documents, PDF/OCR/download counts
     - `ObservationEngine`: Recent perception buffer size and activity
     - `BrowserGraph`: Discovered domains and stale domain count
     - `ExecutionMemory`: Recorded runs and success rate percentages
     - `EntityGraph`: Entities count, relationships count
   - Degradation heuristics: Automatically flags status as `degraded` if browser graphs are stale or execution failure spikes.

## Consequences
- Planners and agents can query multi-hop operational provenance without touching raw capability adapters or database tables.
- Subsystem health is continuously observable for debugging, diagnostics, and automated recovery.
- Architecture remains local-first, memory-safe, and zero-cloud.

