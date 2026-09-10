# Knowledge Store Subsystem

Knowledge Store (`@usepilot/runtime-context/src/knowledge`) manages multi-tier persistence for operational knowledge across execution runs, partitioning transient caches, verified facts, parsed documents, OCR geometries, and domain navigation topologies under strict retention and provenance policies.

---

## Purpose

Autonomous agents accumulate diverse forms of knowledge during task execution: short-lived API responses, validated CSS selectors for web portals, parsed invoice documents, OCR bounding box trees from desktop screenshots, and discovered page navigation paths. Storing these heterogeneous records in a flat, unversioned key-value map causes memory leaks, data corruption from stale selectors, and loss of data origin context.

The Knowledge Store Subsystem owns:
- Multi-tier knowledge categorization (`cache`, `persistent`, `document`, `ocr`, `semantic_fact`, `browser_graph`).
- Policy-driven retention management (`session`, `temporary`, `persistent`, `pinned`).
- TTL expiration with both lazy on-read cleanup and active sweep routines (`cleanExpired()`).
- Bounded LRU cache management enforcing configurable entry limits (`maxCacheEntries`) with pin exemption.
- Cryptographic provenance tracking recording source origin and component attribution on every item.
- Monotonic version incrementation tracking updates to existing keys.
- Ownership of the embedded `BrowserKnowledgeGraph` instance.

The Knowledge Store Subsystem intentionally does NOT own:
- Full-text or vector keyword search (delegated to the Runtime Index Engine).
- Physical disk file I/O for raw binary blobs (delegated to the Runtime Artifact Store).
- Browser automation or live DOM querying (delegated to capability adapters).

---

## Design Principles

### 1. Multi-Tiered Logical Partitioning
Data stored in the knowledge store is partitioned into distinct functional tiers using compound keys (`${category}:${key}`):
- **Cache Tier**: Ephemeral values with default 300-second TTLs subject to LRU pruning.
- **Persistent Tier**: High-confidence facts (e.g. validated button selectors, domain authentication states) that persist across tasks.
- **Document Tier**: Structured text and tabular datasets parsed from PDFs, CSVs, or downloads.
- **OCR Tier**: Keyed by SHA-256 image hashes, storing text recognition bounding boxes to eliminate redundant OCR computation on unchanged screens.
- **Browser Graph Tier**: Route topologies, form definitions, and action descriptors across visited web domains.

### 2. Mandatory Provenance on Every Write
Knowledge without origin is an operational hazard. Every write operation (`setCache`, `setPersistent`, `storeDocument`, `storeOcr`) requires a `ContextProvenance` object specifying the creator, source capability, timestamp, and optional confidence score. Downstream planners can evaluate the trustworthiness of cached facts before relying on them.

### 3. Dual-Phase Expiration Mechanics
Stale cache entries are handled via two complementary mechanisms:
1. **Lazy On-Access Invalidation**: When `getCache(key)`, `getItem(key)`, or `listByCategory(category)` accesses an item whose `expiresAt` is in the past, the item is deleted from memory immediately before returning `undefined`.
2. **Active Sweeping**: The `cleanExpired()` method performs a full linear sweep across all stored items, reclaiming memory from unaccessed expired records.

### 4. Bounded Caching with Pin Protection
Cache entries are capped at `maxCacheEntries` (default 1,000). When new cache entries cause the count to exceed this limit, `pruneCache()` identifies non-pinned cache keys and evicts the oldest items. Entries marked with the `pinned` policy are strictly exempt from LRU pruning.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Single compound-key map (`${category}:${key}`)** | Separate Map per category | Simplifies memory accounting, unified TTL expiration sweeps, snapshot serialization, and global LRU eviction while preserving categorized partition isolation. |
| **Dual-phase expiration (lazy on-read + active sweep)** | Background `setInterval` timer | Background timers in Node.js/Bun prevent event loop drain and cause unexpected process persistence during CLI shutdown or unit test execution. |
| **Pinned retention policy** | Standard LRU eviction | Critical authentication session tokens, base URL endpoints, and core configuration must never be evicted merely because of high cache activity. |
| **In-memory store with snapshot export** | Direct SQLite/LevelDB table per write | Execution runtime requires sub-microsecond in-process read access during planning cycles; persistence is cleanly delegated via snapshot export/import. |

---

## Invariants and Guarantees

1. **Category Isolation**: Items stored under `setCache('auth')` will never collide with `setPersistent('auth')` because internal map keys are prefixed with category tags (`cache:auth` vs `persistent:auth`).
2. **Monotonic Versioning**: Every write or overwrite to an existing key increments its `version` counter by 1.
3. **Pin Exemption**: Entries marked with `RetentionPolicy.Pinned` are immune to automatic LRU cache pruning during `pruneCache()`.
4. **Non-Stale Reads**: Any call to `getItem()`, `getCache()`, or `listByCategory()` guarantees that expired items (`expiresAt <= Date.now()`) are purged immediately and never returned to callers.
5. **Mandatory Provenance**: Writes cannot occur without valid provenance (`creator`, `sourceCapability`, `timestamp`).

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Cache size overflow** | Cache entry count exceeds `maxCacheEntries` | Automatically executes `pruneCache()`, removing oldest non-pinned cache items. | Does not evict pinned items or persistent categories. |
| **Corrupted snapshot import** | Validation check on deserialized record array | Ignores malformed records, logs warning, imports remaining valid records. | Does not crash the runtime context facade. |
| **Stale selector read** | Caller reads expired selector cache | `getCache()` checks TTL lazily, purges record, returns `undefined`. | Does not re-query DOM or trigger locator self-healing. |
| **High memory consumption** | Total item count across all categories grows | Caller or health monitor invokes `cleanExpired()` to purge expired entries. | Does not automatically discard persistent or document tier data without explicit TTL. |

---

## Things To Avoid

- **Do NOT write unpinned temporary entries expecting eternal persistence**: Default cache items have a 300-second TTL; use `setPersistent()` for items meant to outlive the immediate task.
- **Do NOT invent raw keys without category consideration**: Always use helper methods (`setCache`, `setPersistent`, `storeDocument`, `storeOcr`) rather than constructing arbitrary strings.
- **Do NOT bypass provenance**: Every piece of knowledge must record who wrote it and from what capability adapter it originated.
- **Do NOT rely on background intervals for expiration**: Explicitly invoke `cleanExpired()` during scheduled garbage collection or idle cycles.

---

---

## Where It Fits

The Knowledge Store resides in `packages/runtime-context/src/knowledge/` and is managed by `RuntimeContextFacade`.

```
+------------------------------------------------------------------------+
|                          RuntimeContextFacade                          |
+------------------------------------------------------------------------+
                                     |
                                     v
+------------------------------------------------------------------------+
|                             KnowledgeStore                             |
+------------------------------------------------------------------------+
   |              |                   |                  |             |
   v              v                   v                  v             v
+----------+ +--------------+ +---------------+ +------------+ +---------------+
|  Cache   | |  Persistent  | |   Documents   | |    OCR     | | Browser Graph |
| (TTL/LRU)| | (Facts/Keys) | | (Parsed Data) | |(SHA-256 H) | |(Topologies)   |
+----------+ +--------------+ +---------------+ +------------+ +---------------+
   |              |                   |                  |             |
   +--------------+-------------------+------------------+-------------+
                                     |
                                     v
                    +---------------------------------+
                    |     Compound Key Hash Map       |
                    |      Map<string, Item>          |
                    +---------------------------------+
```

### Callers and Collaborators
- **`RuntimeContextFacade`**: Instantiates and delegates knowledge operations to `KnowledgeStore`.
- **Browser Adapter & Vision Subsystem**: Store OCR results and page structure definitions.
- **Self-Healing Pipeline**: Caches repaired selectors in the persistent tier to bypass broken primary locators on future executions.
- **Planner**: Inspects stored facts and web topologies to optimize step generation.

---

## Architecture

```
packages/runtime-context/src/knowledge/
├── types.ts            # KnowledgeCategory, KnowledgeRetentionPolicy, KnowledgeItem
├── knowledge-store.ts  # KnowledgeStore implementation and caching logic
└── browser-graph.ts    # BrowserKnowledgeGraph domain topology manager
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `KnowledgeStore` | Primary store engine. Manages compound-keyed in-memory map, versioning, TTL expiration, cache pruning, and category querying. |
| `BrowserKnowledgeGraph` | Specialized graph sub-store mapping domains to page nodes, form field schemas, and interactive actions. |
| `types.ts` | Type definitions for retention policies, items, forms, page nodes, and domain graph schemas. |

---

## Core Concepts

### 1. Retention Policies
Every item stored in the Knowledge Store is assigned a `KnowledgeRetentionPolicy`:
- `session`: Scoped to the lifetime of the active execution session.
- `temporary`: Time-limited record governed by `expiresAt` (e.g. 5 minutes).
- `persistent`: Survives task boundaries and remains available until explicitly invalidated.
- `pinned`: Persistent and explicitly exempt from any LRU cache eviction thresholds.

### 2. KnowledgeItem Structure

```typescript
export interface KnowledgeItem<T = unknown> {
  id: string                          // e.g. "k-cache-1725760000-a1b2c"
  key: string                         // Raw lookup key (e.g. "amazon.in:checkout_btn")
  category: KnowledgeCategory         // 'cache' | 'persistent' | 'document' | 'ocr' ...
  policy: KnowledgeRetentionPolicy    // 'session' | 'temporary' | 'persistent' | 'pinned'
  data: T                             // Generic payload
  provenance: ContextProvenance       // Source attribution and confidence
  version: number                     // Monotonic revision counter (starts at 1)
  expiresAt?: number | undefined      // Unix epoch timestamp in milliseconds
  createdAt: number                   // Creation timestamp
  updatedAt: number                   // Last modification timestamp
}
```

### 3. Compound Key Isolation
To prevent namespace collisions between different subsystems using identical key strings (e.g. a document named `"invoice"` vs. a cached API key named `"invoice"`), internal map keys combine category and user key:
```
`${category}:${key}` -> "cache:invoice" vs. "document:invoice"
```

---

## Data Flow

```
1. Write Request
   store.setCache('user_session', sessionData, provenance, 600)
      |
      v
2. Item Construction (putItem)
   - Lookup existing compound key ("cache:user_session")
   - version = (existing?.version ?? 0) + 1
   - expiresAt = Date.now() + (600 * 1000)
   - Store in Map under "cache:user_session"
      |
      v
3. Bounded Cache Pruning (pruneCache)
   - If total non-pinned cache entries > maxCacheEntries (1000)
   - Shift and delete oldest excess entries
      |
      v
4. Read Request
   store.getCache('user_session')
      |
      v
5. Lazy Expiration Evaluation
   - Find item under "cache:user_session"
   - If Date.now() > item.expiresAt:
       delete item from map
       return undefined
   - Else return item.data
```

---

## Public API

### `KnowledgeStore`

Located in `packages/runtime-context/src/knowledge/knowledge-store.ts`.

#### Constructor & Singleton
```typescript
constructor(options?: KnowledgeStoreOptions)
static getInstance(): KnowledgeStore
```
`options.maxCacheEntries` sets the LRU eviction threshold (defaults to `1000`).

#### Embedded Sub-Stores
```typescript
getBrowserGraph(): BrowserKnowledgeGraph
```
Returns the embedded `BrowserKnowledgeGraph` instance for web domain mapping.

#### Cache Tier Methods
```typescript
// Store transient value with default 300s TTL
setCache<T>(
  key: string,
  data: T,
  provenance: ContextProvenance,
  ttlSeconds?: number
): KnowledgeItem<T>

// Retrieve cached value; evaluates lazy expiration
getCache<T>(key: string): T | undefined
```

#### Persistent Tier Methods
```typescript
// Store persistent fact
setPersistent<T>(
  key: string,
  data: T,
  provenance: ContextProvenance
): KnowledgeItem<T>

// Retrieve persistent fact
getPersistent<T>(key: string): T | undefined
```

#### Document & OCR Tier Methods
```typescript
// Store document data
storeDocument<T>(
  docId: string,
  data: T,
  provenance: ContextProvenance,
  policy?: KnowledgeRetentionPolicy
): KnowledgeItem<T>

getDocument<T>(docId: string): T | undefined

// Store OCR data keyed by image hash
storeOcr<T>(
  imageHash: string,
  ocrData: T,
  provenance: ContextProvenance
): KnowledgeItem<T>

getOcr<T>(imageHash: string): T | undefined
```

#### Maintenance & Query Methods
```typescript
// Retrieve full KnowledgeItem envelope by compound key ("category:key")
getItem(compoundKey: string): KnowledgeItem | undefined

// List all non-expired items in a category
listByCategory(category: KnowledgeCategory): KnowledgeItem[]

// Remove a specific item
invalidate(category: KnowledgeCategory, key: string): boolean

// Sweep and delete all expired items across the store
cleanExpired(): number

// Total items stored across all categories
getTotalCount(): number
```

---

## Internal Components

### 1. `putItem` Factory
Central internal ingestion method. Handles ID generation (`k-${category}-${Date.now()}-${rand}`), monotonic version bumping, creation/update timestamp stamping, and TTL calculation.

### 2. `pruneCache()`
Scans the item map for entries where `category === 'cache'` and `policy !== 'pinned'`. If the count exceeds `maxCacheEntries`, deletes the oldest items in FIFO order until the cache size conforms to the configured limit.

---

## Lifecycle

```
[KnowledgeStore Initialized]
             |
             v
[Writes from Adapters / Context]
  - setCache(key, data, prov, ttl)
  - setPersistent(key, data, prov)
  - storeOcr(hash, boxes, prov)
             |
             v
[Reads / Queries]
  - getCache(key) -> Checks TTL -> Returns data or undefined
  - getPersistent(key) -> Returns data
             |
             v
[Eviction & Cleanup]
  - Lazy: expired items unlinked during get() or listByCategory()
  - Active: cleanExpired() removes expired keys across all tiers
  - Bounded: pruneCache() drops unpinned cache items over limit
```

---

## Error Handling

The Knowledge Store operates in-memory and does not throw operational exceptions during standard CRUD operations. Missing keys return `undefined`. Invalidation of non-existent keys returns `false`. Corrupted or expired items are purged transparently during retrieval.

---

## Thread Safety and Concurrency

- **Event Loop Single Threading**: Because all map insertions, deletions, and pruning operations are synchronous JavaScript calls, there are no thread race conditions during key manipulation.
- **Atomic Revision Tracking**: Revision numbers increment monotonically per key (`(existing?.version ?? 0) + 1`), providing optimistic concurrency checks if required by callers.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `getCache` / `getPersistent` | O(1) | Sub-microsecond Map lookup. |
| `setCache` / `setPersistent` | O(1) | Map insert + version calculation. |
| `pruneCache` (on overflow) | O(C) where C = cache entries | Iterates cache keys when limit exceeded. |
| `cleanExpired` | O(N) where N = total items | Linear sweep across store; executed during maintenance. |
| `listByCategory` | O(N) | Filters items by category and cleans expired records. |

---

## Testing Strategy

Tests are located in `packages/runtime-context/test/knowledge-store.test.ts`:

- **TTL Expiration**: Inserts items with short TTLs (10ms), advances virtual time, and verifies `getCache()` returns `undefined`.
- **LRU Cache Pruning**: Configures `maxCacheEntries = 5`, inserts 10 items, and confirms that only the 5 most recent items remain.
- **Pin Protection**: Pinned items remain in cache even when non-pinned items are evicted during cache overflow.
- **Version Bumping**: Repeated writes to the same key increment the `version` field sequentially (`1 -> 2 -> 3`).
- **Compound Key Isolation**: Asserts that `setCache('item', 'A')` and `setPersistent('item', 'B')` do not overwrite one another.

---

## Extension Guide

### Adding a New Knowledge Category

1. Add the category literal to `KnowledgeCategory` in `packages/runtime-context/src/knowledge/types.ts`:
   ```typescript
   export type KnowledgeCategory =
     | 'cache'
     | 'persistent'
     | 'browser_graph'
     | 'document'
     | 'ocr'
     | 'semantic_fact'
     | 'workflow_macro' // new category
   ```
2. In `KnowledgeStore`, add typed helper methods:
   ```typescript
   storeMacro<T>(macroId: string, data: T, provenance: ContextProvenance): KnowledgeItem<T> {
     return this.putItem(macroId, 'workflow_macro', 'persistent', data, provenance)
   }

   getMacro<T>(macroId: string): T | undefined {
     const item = this.items.get(`workflow_macro:${macroId}`)
     return item ? (item.data as T) : undefined
   }
   ```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Knowledge Store Map** | `KnowledgeStore` | Adapters, Extractors | Planner, Adapters | Process lifetime | In-memory with snapshot serialization |
| **Cache Tier Items** | `KnowledgeStore` | `setCache()` | `getCache()` | Configured TTL (default 300s) | Pruned via LRU / TTL sweeps |
| **Persistent Facts** | `KnowledgeStore` | `setPersistent()` | `getPersistent()` | Multi-session | Exported with run snapshots |
| **OCR Cache** | `KnowledgeStore` | `storeOcr()` | `getOcr()` | Session / Pinned | Keyed by SHA-256 image hash |
| **Browser Topology Graph** | `KnowledgeStore` | `BrowserKnowledgeGraph` | Planner | Multi-session (24h TTL) | Exported to disk |

---

## Failure Assumptions

1. **In-Memory Volatility**: Assumes raw in-memory knowledge resets on process termination unless exported via `exportAll()` into context snapshots.
2. **Provenance Availability**: Assumes callers can construct valid provenance metadata; writes without provenance are rejected to prevent un-attributable state poisoning.
3. **Finite Entry Capacity**: Assumes cache entries may grow rapidly in intensive automation, enforcing a strict 1,000-entry ceiling (`maxCacheEntries`) with LRU eviction of unpinned keys.

---

## Common Extension Points

- **Adding a Retention Policy**: Add new policy literal to `KnowledgeRetentionPolicy` in `packages/runtime-context/src/knowledge/types.ts` and update `pruneCache()` / `cleanExpired()` enforcement rules.
- **Custom Eviction Callbacks**: Register eviction observers on `KnowledgeStore` to notify external telemetry when high-value facts are dropped.

---

## Directory Layout

```
packages/runtime-context/src/knowledge/
├── types.ts            # Type contracts, item envelopes, and graph interfaces
├── knowledge-store.ts  # Core KnowledgeStore implementation
└── browser-graph.ts    # BrowserKnowledgeGraph domain topology engine
```

---

## Examples

### 1. Storing and Retrieving Cached API Responses
```typescript
import { KnowledgeStore } from '@usepilot/runtime-context'
import { createProvenance } from '@usepilot/runtime-context'

const store = KnowledgeStore.getInstance()
const provenance = createProvenance('browser-adapter', { confidence: 0.95 })

// Cache for 60 seconds
store.setCache('user_profile_123', { name: 'Alice', role: 'Admin' }, provenance, 60)

const user = store.getCache<{ name: string; role: string }>('user_profile_123')
console.log(user?.name) // "Alice"
```

### 2. Persisting Verified Selectors
```typescript
const provenance = createProvenance('self-healing', { confidence: 1.0 })

// Persist validated selector across tasks
store.setPersistent(
  'portal.acme.com:invoice_download_btn',
  'button[data-test="download-pdf"]',
  provenance
)

const selector = store.getPersistent<string>('portal.acme.com:invoice_download_btn')
console.log(selector) // "button[data-test=\"download-pdf\"]"
```

### 3. Storing Deduplicated OCR Results by Image Hash
```typescript
const imageHash = 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'
const ocrPayload = {
  detectedTexts: [
    { text: 'Invoice #4021', bbox: [100, 200, 150, 25], confidence: 0.98 }
  ]
}

store.storeOcr(imageHash, ocrPayload, createProvenance('vision-subsystem'))

// Check if OCR already exists before running expensive recognition
const cachedOcr = store.getOcr(imageHash)
if (cachedOcr) {
  console.log('Skipping OCR inference, found cached text:', cachedOcr)
}
```

---

## Related Documentation

- [Runtime Context Documentation](../runtime-context/README.md) - Context engine architecture.
- [Browser Knowledge Graph](../browser-graph/README.md) - Web domain topologies and route verification.
- [Runtime Index Documentation](../runtime-index/README.md) - Hybrid search across indexed artifacts.
- [Vision Subsystem Documentation](../vision/README.md) - Visual perception and OCR extraction.
