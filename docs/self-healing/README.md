# Deterministic Self-Healing

The Self-Healing Pipeline guarantees automated recovery from website and application UI alterations without using LLMs in the execution loop.

## The 5-Stage Recovery Cascade

```
Target Element Selector Failed
       │
       ▼
1. DOM Fallback (aria-label, placeholder, name, role)
       │ (if not found)
       ▼
2. Semantic Lookup (visible text search, accessible role traversal)
       │ (if not found)
       ▼
3. Visual Template Matching (pixel comparison with reference assets)
       │ (if not found)
       ▼
4. Local OCR Lookup (text bounding-box localization in viewport)
       │ (if not found)
       ▼
5. Exponential Backoff Retry (re-poll with jitter)
       │ (if all stages exhausted)
       ▼
Deterministic Failure (logged to Execution Journal)
```

## Journal Integration

Every self-healing attempt emits a structured entry into the `ExecutionJournal`:
- Stage attempted (`dom` | `semantic` | `visual` | `ocr` | `retry`)
- Method and target descriptor
- Duration (ms)
- Success flag and resolved coordinates/element

All recovery statistics are permanently recorded in the cryptographic `ExecutionManifest`.
