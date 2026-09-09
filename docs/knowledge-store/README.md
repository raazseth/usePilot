# KnowledgeStore Subsystem

The **KnowledgeStore Subsystem** acts as the primary knowledge repository for usePilot.

## Layer Hierarchy
```
KnowledgeStore
├── Cache Layer (LRU/TTL transient cache)
├── Persistent Knowledge (validated selectors, DOM fingerprints)
├── Browser Knowledge (BrowserKnowledgeGraph)
├── Documents (parsed PDFs, extracted tables)
├── OCR (OCR recognition results, bounding boxes)
└── Semantic Index (hybrid keyword/semantic index interface)
```

## Retention Policies
- `session`: Retained only for the active execution session.
- `temporary`: Time-to-live expiration (e.g. 5 minutes).
- `persistent`: Kept indefinitely until manually invalidated.
- `pinned`: Guaranteed exemption from LRU eviction.

## Usage Example
```typescript
import { KnowledgeStore, createProvenance } from '@usepilot/runtime-context'

const store = KnowledgeStore.getInstance()
const prov = createProvenance('planner')

// Persistent Fact
store.setPersistent('amazon.in:tax_selector', '#tax-invoice-link', prov)

// Transient Cache
store.setCache('temp_token', { token: 'xyz' }, prov, 60)
```
