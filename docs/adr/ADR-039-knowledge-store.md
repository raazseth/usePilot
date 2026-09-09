# ADR-039: KnowledgeStore Architecture & Asset Retention

## Status
Accepted

## Context
Treating extracted facts, DOM fingerprints, OCR parses, and document schemas merely as "cache" implies they are disposable and ephemeral. However, in an AI computer operating system, these represent valuable knowledge assets discovered through past labor.

## Decision
We establish the `KnowledgeStore` as a first-class knowledge management substrate:
```
KnowledgeStore
├── Cache Layer (LRU/TTL transient cache)
├── Persistent Knowledge (validated selectors, DOM fingerprints)
├── Browser Knowledge (BrowserKnowledgeGraph)
├── Documents (parsed PDFs, extracted tables)
├── OCR (OCR recognition results, bounding boxes)
└── Semantic Index (hybrid keyword/semantic index interface)
```
The transient cache becomes an internal implementation detail with configurable LRU and TTL limits, while domain assets remain persistent and queryable.

## Consequences
- Long-term efficiency: Avoids re-crawling, re-parsing, or re-OCR-ing static resources.
- Provenance on every item: Every asset stores its origin adapter, timestamp, and confidence score.
