# ADR-031: Runtime Artifact Store with Stable Virtual URIs

## Context
During workflow execution, adapters produce and consume numerous files: screenshots, HTML pages, DOM dumps, OCR output, user downloads, and reports. Storing these haphazardly or exposing host filesystem paths (`C:\Users\...`) to the planner or execution journal violates local privacy, breaks reproducibility, and makes cross-platform execution analysis impossible.

## Decision
Introduce a first-class, immutable **Runtime Artifact Store** (`ArtifactStore` and `ArtifactManager`):
1. **Isolated Execution Directory**: Every execution run owns its own deterministic directory structure: `run/{screenshots, downloads, uploads, ocr, dom, html, extracted, reports, logs, browser}/`.
2. **Canonical Virtual URIs**: All assets are identified by immutable virtual URIs in the format `artifact://<executionId>/<category>/<fileName>`.
3. **Cryptographic Integrity**: Computes SHA-256 digests and records size, MIME type, producer component, creation timestamp, and tags for every stored artifact.
4. **Privacy Bar**: Raw OS paths are never leaked into planner context or execution journals.

## Consequences
- Clean, structured asset isolation per execution.
- Enables safe sharing, auditing, and forensic analysis of execution runs.
