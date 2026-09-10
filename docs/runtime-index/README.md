# Runtime Index Subsystem

Runtime Index (`@usepilot/runtime-context/src/index`) provides in-memory hybrid keyword and vector retrieval across unstructured text, OCR outputs, web snapshots, and execution artifacts, running 100% locally with zero external search cluster dependencies.

---

## Purpose

Automated agents continuously generate and ingest vast amounts of textual and semi-structured data: 50-page PDF financial reports, OCR text recognized from desktop applications, downloaded CSV files, rendered web page HTML dumps, and execution logs. If this data is stored only as raw files on disk, an agent cannot answer questions like:
- "Where was the invoice payment confirmation code located?"
- "Which downloaded document contains the customer's account number?"
- "What OCR text was visible on the screen when the error occurred?"

The Runtime Index Subsystem owns:
- Document indexing and batch ingestion across nine entity types (`pdf`, `document`, `download`, `screenshot`, `ocr`, `browser_page`, `execution_report`, `note`, `clipboard`).
- Hybrid search scoring combining BM25-style keyword matching with local vector cosine similarity.
- Multi-dimensional query filtering (entity types, custom tags, date ranges).
- Automatic text snippet extraction and title match highlighting.
- URI-based document deletion (`removeByUri`) and custom predicate purging.
- Category-partitioned document counting and index statistics.

The Runtime Index Subsystem intentionally does NOT own:
- Raw binary blob storage on disk (delegated to the Runtime Artifact Store).
- OCR image recognition or PDF text parsing (handled before indexing by Vision/Extractor subsystems).
- Remote vector database clustering (operates 100% locally in-memory for speed and privacy).

---

## Design Principles

### 1. Hybrid Keyword and Semantic Scoring
Keyword searches excel at exact identifiers (e.g. order IDs, SKU codes, filenames), while vector embeddings excel at semantic conceptual matching (e.g. "billing issue" matching an invoice failure). The subsystem integrates both into a unified scoring equation:
```
totalScore = keywordScore + (vectorScore * 2.0)
```
- A match in the document title grants a high keyword weight (`+3.0`).
- A match in the document content grants a standard keyword weight (`+1.0`).
- Vector cosine similarity adds up to `+2.0` to the score.
- Match type is classified dynamically as `'keyword'`, `'semantic'`, or `'hybrid'`.

### 2. Zero-Cloud Privacy Invariant
All text indexing, tokenization, filtering, and vector cosine calculations run locally in the active Node.js process. Sensitive customer documents, proprietary source code, and confidential clipboard data never leave the host machine for indexing or searching.

### 3. Contextual Snippet Highlighting
Returning whole documents to an agent model wastes context token budgets. During search, the index identifies the character offset of matched terms and extracts a 60-character surrounding snippet window, providing immediate context without requiring the caller to re-parse the full document text.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **In-memory inverted index + cosine similarity** | External vector database (Pinecone, Chroma, Qdrant) | Eliminates heavyweight network dependencies, binary native compilation issues, and cloud egress costs. Keeps latency sub-millisecond and ensures strict zero-cloud data privacy for sensitive enterprise data. |
| **Hybrid scoring formula (`keyword + 2.0 * vector`)** | Reciprocal Rank Fusion (RRF) | Linear weighting provides predictable, transparent scoring where exact title or identifier matches can overcome fuzzy vector similarity when searching for specific order numbers, error codes, or file names. |
| **Surrounding snippet extraction (60-char window)** | Full document retrieval | LLM context windows and IPC payloads are constrained; returning focused keyword windows allows planners to quickly verify relevance before loading full artifact content. |
| **URI-keyed uniqueness (`removeByUri`)** | Auto-incrementing numeric IDs | Documents and files in usePilot already have canonical artifact URIs (`artifact://run/downloads/...`). Using the URI directly guarantees idempotency when re-indexing modified files. |

---

## Invariants and Guarantees

1. **Zero External Data Transit**: Indexing, tokenization, vector scoring, and snippet generation execute 100% locally in-process. No data is sent over the network.
2. **Idempotent Document Storage**: Adding a document with an existing `uri` replaces the previous index record, preventing duplicate search results.
3. **Deterministic Search Scoring**: Given identical index state, query string, and optional query vector, search results and ranking orders are completely reproducible.
4. **Vector Dimension Agnosticism**: When vector similarity is computed, cosine similarity requires both document and query vectors to have non-zero length and matching dimensionality. Missing or mismatched vectors degrade cleanly to pure keyword scoring.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Query vector dimension mismatch** | Query vector length != document vector length | Ignores vector score for that document, logs debug warning, falls back to keyword matching. | Does not truncate or pad vector arrays. |
| **Empty document text** | `doc.content` is empty or whitespace | Indexes document metadata (title, tags, entity type) so title-based queries still succeed. | Does not reject document insertion. |
| **High document volume / Memory limit** | Heap memory pressure or large index count | Caller invokes `removeWhere()` or `clear()` to prune obsolete task records. | Does not automatically page vectors to disk (in-memory by design). |
| **Special characters in query** | Regex or punctuation in query terms | Splits query on whitespace and normalizes to lower-case tokens. | Does not throw regex syntax errors. |

---

## Things To Avoid

- **Do NOT pass multi-megabyte binary strings as `content`**: The index is intended for text, logs, and OCR outputs; store raw binary blobs in the Artifact Store and index only extracted textual representations.
- **Do NOT omit `uri` or `entityType`**: Canonical URIs ensure idempotency, and entity types enable essential filtering during planning and diagnosis.
- **Do NOT invoke external cloud embedding APIs in hot loops**: Compute embeddings asynchronously and supply them to `indexDocument` only when semantic search is needed.
- **Do NOT bypass `RuntimeContextFacade`**: Access the index through the facade to ensure synchronized lifecycle management with the active execution run.

---

---

## Where It Fits

The Runtime Index Subsystem resides in `packages/runtime-context/src/index/` and is integrated with `RuntimeContextFacade`.

```
+-------------------------------------------------------------------------+
|                          Execution Pipeline                             |
+-------------------------------------------------------------------------+
       |                                                    |
       | Generated Artifacts (PDF, OCR, Download)           | Agent Queries
       v                                                    v
+-----------------------------+               +--------------------------+
|     Document Extraction     |               |    AI Planner / Tools    |
+-----------------------------+               +--------------------------+
       |                                                    |
       | index(doc) / indexBatch(docs)                      | search(query)
       v                                                    v
+-------------------------------------------------------------------------+
|                          RuntimeIndexEngine                             |
|  - Map<string, IndexDocument>                                           |
|  - Filters: entityTypes, tags, date range                               |
|  - Scoring: Title boost (+3.0) + Content (+1.0) + Cosine Sim (x2.0)     |
+-------------------------------------------------------------------------+
                                     |
                                     | Returns SearchResult[]
                                     v
+-------------------------------------------------------------------------+
|                            Search Results                               |
|  - document: IndexDocument                                              |
|  - score: number (e.g. 5.4)                                             |
|  - matchType: 'keyword' | 'semantic' | 'hybrid' | 'exact'                |
|  - highlights: ["...invoice #8912 confirmed paid..."]                   |
+-------------------------------------------------------------------------+
```

### Callers and Collaborators
- **Artifact Extractor**: Feeds parsed PDF text, CSV dumps, and download text into `index()`.
- **Vision Subsystem**: Ingests recognized OCR strings with bounding box references.
- **`RuntimeContextHealthMonitor`**: Calls `count()` across entity types (`pdf`, `download`, `ocr`) to verify index activity.
- **AI Planner & User Chat**: Dispatches queries via `search()` to answer user requests or ground multi-step plans.

---

## Architecture

```
packages/runtime-context/src/index/
├── types.ts           # IndexedEntityType, IndexDocument, SearchQuery, SearchResult
└── runtime-index.ts   # RuntimeIndexEngine implementation, cosine similarity, and search
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `RuntimeIndexEngine` | Primary search engine. Manages document map, executes multi-stage filter queries, computes hybrid scores, and returns sorted candidate results. |
| `IndexDocument` | Unified document schema encapsulating title, content, entity type, tags, vector embedding, and provenance. |
| `SearchQuery` | Query options containing search string, optional vector, type filters, tag filters, and timestamps. |
| `SearchResult` | Candidate match with composite score, match classification, and text snippets. |

---

## Core Concepts

### 1. Document Schema (`IndexDocument`)

```typescript
export interface IndexDocument {
  id: string                          // Unique identifier, e.g. "doc-pdf-102"
  entityType: IndexedEntityType       // Categorized entity type
  title: string                       // Searchable title (receives 3x score boost)
  content: string                     // Full-text document or extraction payload
  uri?: string                        // Canonical artifact URI (e.g. artifact://...)
  tags: string[]                      // Searchable taxonomy tags
  metadata?: Record<string, unknown>  // Arbitrary custom metadata
  provenance: ContextProvenance       // Source capability and confidence
  vector?: number[]                   // Local embedding vector (e.g. 384-dim or 768-dim)
  indexedAt: number                   // Unix epoch timestamp in milliseconds
}
```

### 2. Entity Types (`IndexedEntityType`)
- `pdf`: Extracted text from PDF files.
- `document`: Markdown, plain text, or Word documents.
- `download`: User files saved from web download operations.
- `screenshot`: Descriptions or annotations linked to image captures.
- `ocr`: Text extracted from image recognition pipelines.
- `browser_page`: Serialized text and headings from web pages.
- `execution_report`: Summary manifests of completed runs.
- `note`: Scratchpad notes and human annotations.
- `clipboard`: Text snippets read from the host operating system clipboard.

### 3. Cosine Similarity Calculation
When a query includes a numerical vector embedding (`vector`), the engine computes standard cosine similarity against indexed document vectors:
```typescript
private cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, magA = 0, magB = 0
  for (let i = 0; i < a.length; i++) {
    const valA = a[i] ?? 0
    const valB = b[i] ?? 0
    dot += valA * valB
    magA += valA * valA
    magB += valB * valB
  }
  const mag = Math.sqrt(magA) * Math.sqrt(magB)
  return mag === 0 ? 0 : dot / mag
}
```

---

## Data Flow

```
1. Document Ingestion
   runtimeIndex.index({
     id: 'inv-4001',
     entityType: 'pdf',
     title: 'Amazon Web Services Invoice August',
     content: 'Account #123-456. Total Due: $1,420.00. Payment received.',
     uri: 'artifact://run-1/downloads/aws-august.pdf',
     tags: ['billing', 'aws'],
     provenance: createProvenance('extractor'),
     indexedAt: Date.now()
   })
      |
      v
2. Search Query Dispatched
   runtimeIndex.search({
     query: 'AWS August payment',
     entityTypes: ['pdf'],
     tags: ['billing']
   })
      |
      v
3. Candidate Filtering
   - Checks entityType === 'pdf'
   - Confirms doc.tags includes 'billing'
   - Checks timestamp bounds (if supplied)
      |
      v
4. Scoring & Snippet Extraction
   - Terms: ['aws', 'august', 'payment']
   - Title matches 'aws' (+3) and 'august' (+3) -> keywordScore = 6
   - Content matches 'payment' (+1) -> keywordScore = 7
   - Extracts snippet: "...Total Due: $1,420.00. Payment received...."
      |
      v
5. Sort & Return
   - candidates.sort by descending score
   - Slices to limit (default 20)
   - Returns SearchResult[]
```

---

## Public API

### `RuntimeIndexEngine`

Located in `packages/runtime-context/src/index/runtime-index.ts`.

#### Singleton & Constructor
```typescript
static getInstance(): RuntimeIndexEngine
```

#### Ingestion & Removal Methods
```typescript
// Add or overwrite a document
index(document: IndexDocument): void

// Batch insert multiple documents
indexBatch(docs: IndexDocument[]): void

// Retrieve single document by ID
get(id: string): IndexDocument | undefined

// Remove single document by ID
remove(id: string): boolean

// Remove documents matching a URI or URI prefix
removeByUri(uri: string): number

// Remove all documents matching a custom predicate
purge(predicate: (doc: IndexDocument) => boolean): number

// Clear entire index
clear(): void
```

#### Query & Statistics Methods
```typescript
// Execute hybrid keyword/vector search
search(options: SearchQuery): SearchResult[]

// Count total indexed documents or filter by entity type
count(entityType?: IndexedEntityType): number
```

---

### Data Contracts

#### `SearchQuery`
```typescript
export interface SearchQuery {
  query: string
  entityTypes?: IndexedEntityType[] | undefined
  tags?: string[] | undefined
  fromTimestamp?: number | undefined
  toTimestamp?: number | undefined
  vector?: number[] | undefined
  limit?: number | undefined // Default: 20
}
```

#### `SearchResult`
```typescript
export interface SearchResult {
  document: IndexDocument
  score: number // Higher is more relevant
  matchType: 'exact' | 'keyword' | 'semantic' | 'hybrid'
  highlights: string[]
}
```

---

## Internal Components

### 1. Snippet Window Generator
When a keyword term matches the document body, the engine generates an contextual snippet window:
```typescript
const matchIdx = contentLower.indexOf(term)
const start = Math.max(0, matchIdx - 20)
const snippet = doc.content.slice(start, start + 60).replace(/[\r\n]+/g, ' ')
highlights.push(`...${snippet}...`)
```
This isolates the matched phrase with 20 leading and 40 trailing characters, normalizing newlines for single-line display.

### 2. Match Type Classifier
Matches are classified based on the relative contributions of keyword and vector scores:
- `hybrid`: `keywordScore > 0` AND `vectorScore > 0.5`.
- `semantic`: `vectorScore > 0.5` AND `keywordScore === 0`.
- `keyword`: `keywordScore > 0` AND `vectorScore <= 0.5`.
- `exact`: Filter-only query without text terms.

---

## Lifecycle

```
[RuntimeIndex Initialized]
             |
             v
[Artifacts Parsed & Ingested]
  - index(pdfDoc)
  - index(ocrDoc)
  - index(clipboardDoc)
             |
             v
[Hybrid Searches Executed]
  - search({ query: 'order ID', entityTypes: ['download'] })
             |
             v
[Targeted Invalidation]
  - removeByUri('artifact://run-1/downloads/file.pdf')
  - purge(doc => doc.indexedAt < oneWeekAgo)
```

---

## Error Handling

Search operations are non-throwing. If an empty query string is supplied, the engine returns all documents matching the specified filters with `score: 1.0` and `matchType: 'exact'`. If vector lengths do not match during cosine similarity computation, vector scoring is safely skipped.

---

## Thread Safety and Concurrency

- **Synchronous Map Execution**: Document insertion, deletion, and search loops run synchronously in JavaScript.
- **Thread Isolation**: The index operates within the single-threaded Node.js event loop without shared-memory concurrency issues.

---

## Performance Characteristics

| Operation | Complexity | Latency / Overhead |
| :--- | :--- | :--- |
| `index(doc)` | O(1) | Sub-microsecond Map insertion. |
| `get(id)` / `remove(id)` | O(1) | Sub-microsecond Map lookup. |
| `search(query)` (Keyword) | O(D * T) where D = docs, T = terms | ~1 - 5 ms for 10,000 documents. |
| `search(query)` (Vector) | O(D * V) where V = vector dimension | ~5 - 15 ms for 1,000 384-dim vectors. |
| `count(entityType)` | O(D) | Linear scan over document map. |

---

## Testing Strategy

Tests are located in `packages/runtime-context/test/runtime-index.test.ts`:

- **Title Boost Verification**: Confirms that a document containing a search term in its title scores higher than a document containing it only in its body.
- **Filter Precision**: Asserts that filtering by `entityTypes: ['pdf']` excludes documents of type `'ocr'` or `'download'`.
- **Date Range Boundary**: Verifies that documents outside `fromTimestamp` and `toTimestamp` are excluded.
- **Snippet Accuracy**: Confirms that returned highlights contain the matching substring and surrounding context.
- **URI Prefix Invalidation**: Verifies that `removeByUri()` successfully deletes all documents matching an execution URI prefix.

---

## Extension Guide

### Adding New Searchable Entity Types

1. In `packages/runtime-context/src/index/types.ts`, add the type literal:
   ```typescript
   export type IndexedEntityType =
     | 'pdf'
     | 'document'
     // ...
     | 'voice_transcript' // new entity type
   ```
2. In the ingestion pipeline, pass `entityType: 'voice_transcript'` when invoking `runtimeIndex.index()`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Inverted Index** | `RuntimeIndexEngine` | `index()`, `removeByUri()` | Planner, Forensics | Execution session | Volatile in-memory |
| **Indexed Documents** | `RuntimeIndexEngine` | Ingestion pipelines | Search queries | Session duration | Re-indexed from disk artifacts if needed |
| **Vector Embeddings** | `RuntimeIndexEngine` | Optional embedding generators | Cosine similarity match | Ingested per document | Stored in document record |

---

## Failure Assumptions

1. **Local Memory Bounds**: Assumes indexed text documents fit comfortably within process heap limits (<50,000 documents). Large binary payloads must be stored in ArtifactStore, with only extracted text indexed.
2. **Vector Dimensionality Consistency**: Assumes all document vectors within a query comparison share identical length; dimensions that mismatch are safely bypassed without breaking keyword matches.
3. **Deterministic Tokenization**: Assumes whitespace and punctuation splitting on lower-cased text provides reliable multi-token indexing without language-specific stemming dependencies.

---

## Common Extension Points

- **Adding an Entity Type**: Extend `IndexEntityType` union in `packages/runtime-context/src/index/types.ts` to categorize custom extraction outputs.
- **Custom Tokenizers and Filters**: Override tokenization in `tokenize()` to support specialized identifier syntaxes (e.g. tracking numbers, code syntax tokens).

---

## Directory Layout

```
packages/runtime-context/src/index/
├── types.ts          # IndexDocument, SearchQuery, and SearchResult interfaces
└── runtime-index.ts  # RuntimeIndexEngine core search and scoring engine
```

---

## Examples

### 1. Ingesting and Searching a Downloaded Invoice
```typescript
import { RuntimeIndexEngine } from '@usepilot/runtime-context'
import { createProvenance } from '@usepilot/runtime-context'

const index = RuntimeIndexEngine.getInstance()

// 1. Index document
index.index({
  id: 'doc-inv-99',
  entityType: 'pdf',
  title: 'Stripe Tax Invoice June 2026',
  content: 'Receipt for $45.00 USD. Billed to Acme Corp. Status: Paid in full.',
  uri: 'artifact://run-12/downloads/stripe-june.pdf',
  tags: ['billing', 'stripe'],
  provenance: createProvenance('extractor'),
  indexedAt: Date.now(),
})

// 2. Perform search
const results = index.search({
  query: 'Stripe Invoice Paid',
  entityTypes: ['pdf'],
  tags: ['billing'],
})

console.log('Top Result:', results[0]?.document.title)
console.log('Score:', results[0]?.score)
console.log('Highlights:', results[0]?.highlights)
```

### 2. Hybrid Keyword and Semantic Search
```typescript
const queryVector = [0.12, -0.45, 0.88, /* ... 384 dimensions */]

const results = index.search({
  query: 'payment receipt',
  vector: queryVector,
  limit: 5,
})

for (const match of results) {
  console.log(`[${match.matchType.toUpperCase()}] ${match.document.title} (Score: ${match.score})`)
}
```

### 3. Cleaning Up Artifacts for a Purged Execution Run
```typescript
// Purge all indexed entries associated with an execution run
const deletedCount = index.removeByUri('artifact://exec-old-run/')
console.log(`Removed ${deletedCount} indexed documents from index`)
```

---

## Related Documentation

- [Runtime Context Documentation](../runtime-context/README.md) - Context engine overview.
- [Knowledge Store Documentation](../knowledge-store/README.md) - Persistent memory and cache tiers.
- [Runtime Artifact Subsystem](../artifacts/README.md) - Canonical artifact storage and virtual URIs.
- [Vision Subsystem Documentation](../vision/README.md) - OCR text extraction ingested into the runtime index.
