# Browser Knowledge Graph Subsystem

Browser Knowledge Graph (`@usepilot/runtime-context/src/knowledge/browser-graph`) maps and validates the structural topology of navigated web applications, recording domain paths, form schemas, action descriptors, and authentication boundaries into a versioned graph with SHA-256 layout drift detection.

---

## Purpose

Automated agents often navigate complex multi-page web applications (e.g. enterprise ERPs, cloud consoles, e-commerce storefronts). Without an explicit domain topology model:
- The agent blindly re-explores identical navigation menus and button paths on every execution.
- Silent DOM changes on a remote site break execution plans without early detection.
- Form inputs, field names, and submit selectors must be rediscovered repeatedly.
- Planners cannot verify whether a target route requires prior authentication.

The Browser Knowledge Graph Subsystem owns:
- In-memory domain topology graphs (`DomainKnowledgeGraph`) keyed by hostname.
- Structural page nodes (`BrowserPageNode`) tracking paths, titles, parent links, and visit counts.
- Interactive element catalogs: form schemas (`FormFieldDescriptor`) and executable action buttons (`PageActionDescriptor`).
- Cryptographic layout fingerprinting (`computeFingerprint`) generating 16-character SHA-256 digests over sorted paths, forms, and actions.
- Drift detection and confidence scoring (`verifyGraph` reduces confidence to `<= 0.5` upon fingerprint mismatch).
- Knowledge staleness evaluation (`isStale` evaluating 24-hour TTL and confidence thresholds `< 0.7`).
- Full graph serialization (`exportAll` / `importAll`) for multi-session persistence.

The Browser Knowledge Graph Subsystem intentionally does NOT own:
- Playwright page management or network socket connections (owned by `PlaywrightBrowserAdapter`).
- DOM rendering or screenshot capture (owned by the Artifact Subsystem).
- Vector embeddings or full-text indexing (owned by `RuntimeIndexEngine`).

---

## Design Principles

### 1. Zero Redundant Exploration
When an agent visits a page, it records the page node, its parent path, its known forms, and its action buttons. On subsequent runs requiring navigation to the same target (such as an invoice download or checkout page), the planner inspects the Browser Graph and immediately emits direct navigation steps without speculative search.

### 2. Cryptographic Topology Fingerprinting
Websites change over time. If a web application deploys a new interface where forms or button action IDs have changed, the cached topology becomes invalid. The subsystem constructs a deterministic string representation of all sorted paths, forms, and actions:
```
`${path}[${formNames}][${actionIds}]|...`
```
and computes a SHA-256 digest truncated to 16 hex characters. During verification, if the observed fingerprint mismatches the cached fingerprint, the graph confidence drops immediately, alerting the planner that re-exploration is required.

### 3. Progressive Enrichment
Topologies are not constructed in a single monolithic crawl. Every page visit incrementally adds or updates nodes, appends newly detected form fields, records actions, and increments visit counters. The graph evolves naturally alongside task execution.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **16-character SHA-256 structural fingerprint** | Deep AST / DOM tree diffing | Calculating full DOM diffs is computationally expensive and noisy across dynamic SPAs. Sorting paths, form names, and action IDs provides a robust, fast digest that ignores cosmetic HTML variations while catching structural layout changes. |
| **Confidence score degradation on mismatch** | Immediate hard-delete of the domain graph | If a single button changes on a 20-page portal, deleting the entire graph forces unnecessary re-exploration. Degrading confidence (`confidence <= 0.5`) signals the planner to re-verify without completely losing topological route history. |
| **Domain-keyed map isolation** | Global flat graph across all websites | Different web applications have distinct authentication boundaries, route namespaces, and layout drift rates. Scoping by domain prevents cross-site route collisions. |
| **Incremental observation-driven updates** | Pre-execution web crawler | Web crawling can trigger rate-limits, Captchas, or unintended side effects. Building the graph strictly from user- or agent-directed visits guarantees that only relevant application areas are mapped. |

---

## Invariants and Guarantees

1. **Domain Isolation**: Each hostname (`example.com`) owns an independent `DomainKnowledgeGraph`. Operations on one domain never alter or invalidate another.
2. **Monotonic Visit Tracking**: `visitCount` on page nodes increments monotonically with each recorded visit.
3. **Deterministic Fingerprints**: For identical sets of paths, forms, and actions, `computeFingerprint()` generates the identical 16-character hex digest regardless of insertion order.
4. **Staleness Condition**: A domain graph is definitively considered stale (`isStale === true`) if either:
   - Its age exceeds 24 hours (`Date.now() - updatedAt > 24 * 60 * 60 * 1000`), OR
   - Its structural confidence drops below `0.70`.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Remote site redesign** | Observed fingerprint mismatches cached fingerprint in `verifyGraph()` | Sets `confidence = 0.5`, marks graph as needing re-verification, updates `lastFingerprint`. | Does not delete existing node history immediately. |
| **Stale graph loaded** | `isStale(domain)` evaluates to true | Planner triggers fresh DOM analysis and updates nodes incrementally. | Does not block execution flow; planner may still use cached paths as fallback hints. |
| **Path normalization drift** | Variations in URL query parameters or hashes | Caller normalizes URLs to canonical pathnames before calling `recordPage()`. | Subsystem does not guess URL canonicalization rules for arbitrary external APIs. |
| **Corrupted graph import** | Missing required node or domain properties in `importAll()` | Discards malformed domain records, imports valid domains, logs error. | Does not throw unhandled exception. |

---

## Things To Avoid

- **Do NOT wipe the entire domain graph on a single selector failure**: Update the specific action selector or record a new node; the graph confidence mechanism handles graceful degradation.
- **Do NOT pass volatile session query parameters as the page path**: Strip ephemeral query strings (e.g. `?session_id=123`) before recording paths, otherwise fingerprint stability degrades rapidly.
- **Do NOT assume high confidence means zero verification**: When executing high-stakes actions (e.g., checkout or deletion), always verify page identity before executing actions.
- **Do NOT mutate internal node records outside the graph API**: Modifying node properties directly bypasses version incrementation and fingerprint recalculation.

---

---

## Where It Fits

The Browser Knowledge Graph Subsystem resides in `packages/runtime-context/src/knowledge/browser-graph.ts` and is embedded within `KnowledgeStore`.

```
+-------------------------------------------------------------------------+
|                         PlaywrightBrowserAdapter                        |
+-------------------------------------------------------------------------+
                                     |
                                     | 1. Page visits, form inputs, clicks
                                     v
+-------------------------------------------------------------------------+
|                             KnowledgeStore                              |
+-------------------------------------------------------------------------+
                                     |
                                     | getBrowserGraph()
                                     v
+-------------------------------------------------------------------------+
|                       BrowserKnowledgeGraph                             |
+-------------------------------------------------------------------------+
     |                                                              |
     v                                                              v
+-------------------------+                               +-------------------------+
|  DomainKnowledgeGraph   |                               |  DomainKnowledgeGraph   |
|  "portal.acme.com"      |                               |  "billing.stripe.com"   |
+-------------------------+                               +-------------------------+
  |-- rootUrl: "https://..."                                |-- rootUrl: "https://..."
  |-- confidence: 1.0                                       |-- confidence: 0.5 (drift)
  |-- fingerprint: "3a8f1b2c4e5d6a7b"                       |-- fingerprint: "9c1e0a..."
  |-- authenticated: true                                   |-- authenticated: true
  `-- nodes:                                                `-- nodes:
      |-- "/dashboard"                                          `-- "/invoices"
      `-- "/reports" -> { forms: [...], actions: [...] }
```

### Callers and Collaborators
- **`PlaywrightBrowserAdapter`**: Feeds page navigation events, DOM form inputs, and interactive button descriptors into `recordPage`, `recordForm`, and `recordAction`.
- **`RuntimeContextHealthMonitor`**: Calls `listDomains()` and `isStale()` to assess whether cached web topologies remain fresh.
- **AI Planner**: Queries domain graphs to determine optimal execution blueprints and avoid redundant exploratory navigation.

---

## Architecture

```
packages/runtime-context/src/knowledge/
  |-- types.ts           # DomainKnowledgeGraph, BrowserPageNode, FormFieldDescriptor, PageActionDescriptor
  `-- browser-graph.ts   # BrowserKnowledgeGraph implementation, fingerprinting, and staleness rules
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `BrowserKnowledgeGraph` | Core graph engine. Maintains domain hash map, updates nodes, handles verification, computes fingerprints, and evaluates staleness. |
| `DomainKnowledgeGraph` | Root graph record for a single domain, holding metadata, confidence scores, and path nodes. |
| `BrowserPageNode` | Node representing a specific URL path, associated forms, actions, and visit counters. |
| `FormFieldDescriptor` | Structural schema of a form input element (name, type, label, selector, required). |
| `PageActionDescriptor` | Action descriptor representing an interactive trigger (click, submit, download, navigate). |

---

## Core Concepts

### 1. Graph Data Structures

#### `DomainKnowledgeGraph`
```typescript
export interface DomainKnowledgeGraph {
  domain: string                          // e.g. "github.com"
  rootUrl: string                         // e.g. "https://github.com"
  graphVersion: number                    // Monotonic revision counter
  confidence: number                      // 0.0 (untrusted) to 1.0 (verified)
  fingerprint: string                     // 16-character SHA-256 structural hash
  lastVerified: number                    // Timestamp of last successful verification
  nodes: Record<string, BrowserPageNode>  // Keyed by path, e.g. "/settings/billing"
  authenticated: boolean                  // Active authenticated session indicator
  discoveredAt: number                    // Initial creation timestamp
  updatedAt: number                       // Last modification timestamp
}
```

#### `BrowserPageNode`
```typescript
export interface BrowserPageNode {
  path: string                      // Relative path, e.g. "/login"
  url: string                       // Full canonical URL
  title: string                     // Page <title> text
  parentPath?: string               // Inbound navigation path
  forms: FormFieldDescriptor[]      // Identified form structures
  actions: PageActionDescriptor[]   // Executable triggers on page
  requiresAuth?: boolean            // Route requires authenticated state
  lastVisited: number               // Timestamp of last visit
  visitCount: number                // Total times agent visited page
}
```

### 2. Structural Fingerprint Computation
The layout fingerprint is calculated using an invariant serialization of all nodes in a domain:
```typescript
private computeFingerprint(graph: DomainKnowledgeGraph): string {
  const keys = Object.keys(graph.nodes).sort()
  const content = keys
    .map((k) => {
      const n = graph.nodes[k]
      const formNames = n?.forms.map((f) => f.name).sort().join(',') ?? ''
      const actionIds = n?.actions.map((a) => a.actionId).sort().join(',') ?? ''
      return `${k}[${formNames}][${actionIds}]`
    })
    .join('|')

  return createHash('sha256').update(content).digest('hex').slice(0, 16)
}
```
If a web application adds a form, removes a button, or changes an action identifier, the computed hash changes instantly.

### 3. Drift Detection and Verification
When a task navigates to a domain, it can verify the current page against the cached graph:
```typescript
verifyGraph(domain: string, verifiedFingerprint?: string, confidence = 1.0): boolean
```
- If `verifiedFingerprint` matches `graph.fingerprint`: `graph.lastVerified` updates to now, confidence remains high (up to 1.0), and the method returns `true`.
- If `verifiedFingerprint` differs: layout drift is confirmed. `graph.confidence` is clamped to `Math.min(confidence, 0.5)` and the method returns `false`.

### 4. Staleness Invariant (`isStale`)
A domain graph is considered stale if:
1. `Date.now() - graph.lastVerified > maxAgeMs` (default 24 hours / 86,400,000 ms).
2. `graph.confidence < 0.7` (triggered by layout drift or low verification confidence).

---

## Data Flow

```
1. Browser Adapter Visits Page
   browserGraph.recordPage('portal.acme.com', {
     path: '/billing',
     url: 'https://portal.acme.com/billing',
     title: 'Invoices & Billing',
     forms: [],
     actions: []
   })
      |
      v
2. Node Upsert & Fingerprint
   - If domain new -> create DomainKnowledgeGraph
   - Upsert BrowserPageNode, increment visitCount
   - graphVersion += 1
   - fingerprint = computeFingerprint(graph)
      |
      v
3. Interactive Element Discovery
   browserGraph.recordAction('portal.acme.com', '/billing', {
     actionId: 'download_pdf',
     name: 'Download PDF',
     targetSelector: 'button#dl-pdf',
     actionType: 'download'
   })
   - Appends / updates action in node
   - graphVersion += 1, updates fingerprint
      |
      v
4. Subsequent Execution
   - Planner checks browserGraph.getPageNode('portal.acme.com', '/billing')
   - Locates 'download_pdf' selector immediately without live exploration
      |
      v
5. Graph Verification
   browserGraph.verifyGraph('portal.acme.com', liveFingerprint)
   - Matches -> confidence = 1.0
   - Mismatches -> confidence = 0.5 (triggers re-exploration)
```

---

## Public API

### `BrowserKnowledgeGraph`

Located in `packages/runtime-context/src/knowledge/browser-graph.ts`.

#### Core Mutation Methods
```typescript
// Record or update a page node within a domain
recordPage(
  domain: string,
  page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>,
  _provenance?: ContextProvenance
): BrowserPageNode

// Register or update a form schema for a specific page path
recordForm(domain: string, path: string, form: FormFieldDescriptor): boolean

// Register or update an interactive action trigger for a specific page path
recordAction(domain: string, path: string, action: PageActionDescriptor): boolean

// Set domain-level authentication status
setAuthentication(domain: string, authenticated: boolean): void
```

#### Verification & Staleness Methods
```typescript
// Validate graph fingerprint against live observation
verifyGraph(
  domain: string,
  verifiedFingerprint?: string,
  confidence?: number
): boolean

// Check if domain graph has expired or experienced layout drift
isStale(domain: string, maxAgeMs?: number): boolean
```

#### Query & Invalidation Methods
```typescript
// Retrieve full domain graph
getDomainGraph(domain: string): DomainKnowledgeGraph | undefined

// Retrieve specific page node by domain and relative path
getPageNode(domain: string, path: string): BrowserPageNode | undefined

// List all discovered domain strings
listDomains(): string[]

// Delete complete domain graph
invalidateDomain(domain: string): boolean

// Delete individual page node from a domain
invalidatePage(domain: string, path: string): boolean
```

#### Serialization
```typescript
// Export entire graph dictionary for JSON persistence
exportAll(): Record<string, DomainKnowledgeGraph>

// Import graph dictionary from persisted storage
importAll(data: Record<string, DomainKnowledgeGraph>): void
```

---

## Internal Components

### 1. `computeFingerprint(graph)`
Private helper that loops through all sorted paths in `graph.nodes`, serializes form names and action IDs, and returns a 16-character SHA-256 hash.

### 2. Node Upsert Invariant
In `recordPage()`, existing `visitCount` values are preserved and incremented:
```typescript
const existing = graph.nodes[page.path]
const updatedNode: BrowserPageNode = {
  ...page,
  lastVisited: now,
  visitCount: (existing?.visitCount ?? 0) + 1,
}
```

---

## Lifecycle

```
[Agent Visits New Web Domain]
             |
             v
[Domain Graph Provisioned (version 1, confidence 1.0)]
             |
             v
[Progressive Enrichment: recordPage, recordForm, recordAction]
  - Updates node data
  - Increments graphVersion
  - Recomputes SHA-256 fingerprint
             |
             v
[Task Execution Uses Cached Selectors & Routes]
             |
             v
[Periodic verifyGraph() Checks]
  - Fingerprint Match    -> Fresh, confidence maintained
  - Fingerprint Mismatch -> Confidence drops <= 0.5 (Drift Detected)
             |
             v
[Staleness / Invalidation]
  - isStale() flags domains > 24h old or confidence < 0.7
  - invalidateDomain() / invalidatePage() purges outdated paths
```

---

## Error Handling

All mutation methods verify the existence of target graphs and nodes. If `recordForm` or `recordAction` is invoked on a domain or path that has not been initialized via `recordPage`, the call safely returns `false` without throwing an unhandled exception.

---

## Thread Safety and Concurrency

- **Synchronous In-Memory Operations**: Graph modifications execute synchronously within the Node.js event loop tick.
- **Deterministic Fingerprinting**: Sorted array traversal during fingerprint computation ensures that insertion order of forms or actions does not produce false-positive fingerprint mismatches.

---

## Performance Characteristics

| Operation | Complexity | Performance Profile |
| :--- | :--- | :--- |
| `getPageNode(domain, path)` | O(1) | Map lookup followed by object property lookup. |
| `recordPage(domain, page)` | O(P) where P = total paths in domain | Node upsert + SHA-256 fingerprint calculation (< 1 ms for 100 paths). |
| `verifyGraph(domain)` | O(1) | Timestamp and confidence comparison. |
| `listDomains()` | O(D) where D = domain count | Array keys conversion. |
| `exportAll()` | O(D) | Shallow dictionary copy. |

---

## Testing Strategy

Tests are located in `packages/runtime-context/test/browser-graph.test.ts`:

- **Node Creation & Visit Bumping**: Asserts that recording the same page multiple times increases `visitCount` while preserving other metadata.
- **Form & Action Deduplication**: Verifies that adding a form with an existing name updates the descriptor in place rather than creating duplicate array items.
- **Fingerprint Stability**: Confirms that identical node topologies produce identical 16-character SHA-256 digests.
- **Drift Detection**: Feeds a differing fingerprint into `verifyGraph()` and confirms that confidence drops to `0.5` and `verifyGraph()` returns `false`.
- **Staleness Evaluation**: Validates that domains older than 24 hours or with confidence `< 0.7` are flagged as stale by `isStale()`.

---

## Extension Guide

### Adding New Page Capabilities or Attributes

1. In `packages/runtime-context/src/knowledge/types.ts`, add the attribute to `BrowserPageNode`:
   ```typescript
   export interface BrowserPageNode {
     // ... existing fields
     scrollDepth?: number | undefined
     hasIframes?: boolean | undefined
   }
   ```
2. If the new attribute affects layout validity, incorporate it into `computeFingerprint()` in `packages/runtime-context/src/knowledge/browser-graph.ts`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Domain Topologies** | `BrowserKnowledgeGraph` | `recordPage()`, `recordAction()` | Planner, Health Monitor | 24-hour TTL | Exported via `exportAll()` |
| **Page Nodes** | `DomainKnowledgeGraph` | Adapters on page visit | Planner | Tied to domain graph | In-memory with snapshot import/export |
| **Layout Fingerprints** | `BrowserKnowledgeGraph` | `computeFingerprint()` | `verifyGraph()` | Updated on structure change | 16-char hex string |

---

## Failure Assumptions

1. **Host Determinism**: Assumes distinct web domains represent independent authentication and routing namespaces.
2. **Layout Mutability**: Assumes remote third-party web portals update layouts asynchronously, using SHA-256 fingerprint verification to drop confidence to 0.5 upon layout mismatch.
3. **Graceful Degradation**: Assumes stale graphs (>24h old or <0.7 confidence) signal planners to re-explore rather than causing execution aborts.

---

## Common Extension Points

- **Adding Interactive Element Metadata**: Extend `FormFieldDescriptor` or `PageActionDescriptor` in `packages/runtime-context/src/knowledge/browser-graph.ts` (e.g. adding ARIA roles or shadow-root selectors).
- **Custom Fingerprint Algorithms**: Modify `computeFingerprint()` to incorporate additional DOM structural markers or semantic headings.

---

## Directory Layout

```
packages/runtime-context/src/knowledge/
├── types.ts            # DomainKnowledgeGraph and BrowserPageNode schemas
├── browser-graph.ts    # BrowserKnowledgeGraph engine
└── knowledge-store.ts  # Parent KnowledgeStore embedding the browser graph
```

---

## Examples

### 1. Recording a Page Node and Action Button
```typescript
import { BrowserKnowledgeGraph } from '@usepilot/runtime-context'

const graph = new BrowserKnowledgeGraph()

// 1. Record page visit
graph.recordPage('console.cloud.google.com', {
  path: '/storage/browser',
  url: 'https://console.cloud.google.com/storage/browser',
  title: 'Cloud Storage Buckets',
  forms: [],
  actions: [],
  requiresAuth: true,
})

// 2. Record interactive button on that page
graph.recordAction('console.cloud.google.com', '/storage/browser', {
  actionId: 'create_bucket_btn',
  name: 'Create Bucket',
  targetSelector: 'button[aria-label="Create bucket"]',
  actionType: 'click',
})

// 3. Inspect cached action
const node = graph.getPageNode('console.cloud.google.com', '/storage/browser')
console.log('Action selector:', node?.actions[0]?.targetSelector)
// "button[aria-label=\"Create bucket\"]"
```

### 2. Detecting Layout Drift via Fingerprints
```typescript
const domainGraph = graph.getDomainGraph('console.cloud.google.com')
console.log('Initial fingerprint:', domainGraph?.fingerprint)

// Verify with an altered remote fingerprint
const isVerified = graph.verifyGraph('console.cloud.google.com', 'mismatched_hash')

if (!isVerified) {
  console.warn('Remote page layout has changed! Confidence dropped.')
  console.log('New Confidence:', graph.getDomainGraph('console.cloud.google.com')?.confidence) // 0.5
}
```

### 3. Checking for Stale Domain Topologies
```typescript
if (graph.isStale('console.cloud.google.com')) {
  console.log('Knowledge graph for domain is stale. Triggering re-crawl.')
}
```

---

## Related Documentation

- [Knowledge Store Documentation](../knowledge-store/README.md) - Parent multi-tier knowledge repository.
- [Browser Subsystem Documentation](../browser/README.md) - Browser automation adapter and DOM navigation.
- [Runtime Context Health Monitoring](../health/README.md) - Domain staleness audit rules in health reporting.
