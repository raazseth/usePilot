# Runtime Artifact Subsystem

Artifact Storage (`@usepilot/execution-core/src/artifacts`) provides content-addressed, verified local persistence for binary and textual assets produced during execution runs, isolating host paths behind canonical virtual URIs and verifying SHA-256 digests.

---

## Purpose

During automated task execution, agents interact with web pages, the desktop environment, and local files. These interactions generate heavy assets: viewport screenshots, raw HTML dumps, DOM accessibility snapshots, OCR detection geometries, downloaded files, Playwright trace archives, structured CSV/JSON exports, and execution summaries.

The Runtime Artifact Subsystem owns:
- Persistent disk storage and partitioned directory topologies for all execution assets.
- Canonical virtual URI generation (`artifact://<executionId>/<category>/<fileName>`).
- SHA-256 content checksum computation for tamper detection and integrity verification.
- Metadata indexing, MIME type classification, and querying across execution runs.
- Disk-backed metadata manifest persistence (`artifacts-meta.json`) for recovery across process restarts.
- Storage accounting and atomic cleanup of execution-scoped storage.

The Runtime Artifact Subsystem intentionally does NOT own:
- Execution scheduling, workflow orchestration, or retry logic.
- Cloud object sync or remote backup pipelines.
- In-memory knowledge graphs or runtime state representation (delegated to `@usepilot/runtime-context`).
- Vision inference or OCR parsing algorithms (delegated to the Vision subsystem).

---

## Design Principles

### 1. Host Path Isolation via Virtual URIs
Direct host filesystem paths (`C:\Users\...` or `/var/run/...`) leak host environments, user identities, and operating system specifics to the agent and external models. The artifact subsystem abstracts all physical storage paths behind a canonical URI scheme:
`artifact://<executionId>/<category>/<fileName>`

Agents, execution contexts, and loggers communicate strictly in terms of these URIs. Only the artifact engine resolves virtual URIs to physical filesystem paths when performing disk reads or exports.

### 2. Cryptographic Integrity by Default
Every stored artifact is hashed synchronously during persistence using SHA-256. The resulting hex digest is recorded in the metadata object alongside exact byte counts. If an asset on disk is altered or corrupted, downstream verifiers and audit tools detect the mismatch immediately.

### 3. Categorized Partitioning
Artifacts are partitioned into ten fixed, well-defined categories on disk. This prevents directory bloat, makes manual inspection predictable, and allows targeted lifecycle management (such as deleting all trace zips while preserving audit reports).

### 4. Zero Payload In-Memory Retention
The artifact store never retains file buffers in memory. Once a payload is written to disk, its buffer is released for garbage collection. Only lightweight `ArtifactMetadata` descriptors remain in the hot cache, keeping the memory footprint minimal even when capturing hundreds of megabytes of video traces or screenshots.

---

## Where It Fits

The Runtime Artifact Subsystem sits inside `packages/execution-core` and acts as the shared persistence utility for browser adapters, desktop adapters, vision engines, and the execution runner.

```
+-------------------------------------------------------------+
|                     Execution Engine                        |
+-------------------------------------------------------------+
         |                                           |
         v                                           v
+------------------+                       +------------------+
| Browser Adapter  |                       | Vision Subsystem |
|  - screenshots   |                       |  - OCR JSON      |
|  - DOM snapshots |                       |  - visual diffs  |
|  - traces        |                       +------------------+
+------------------+                                 |
         |                                           |
         +-------------------+   +-------------------+
                             |   |
                             v   v
                 +-----------------------+
                 |    ArtifactManager    |
                 +-----------------------+
                             |
                             v
                 +-----------------------+
                 |     ArtifactStore     |
                 +-----------------------+
                   /         |         \
                  /          |          \
                 v           v           v
          +------------+ +-------+ +------------------+
          | Memory Map | | Disk  | | artifacts-meta   |
          |  (Cache)   | | Files | |   .json (Log)    |
          +------------+ +-------+ +------------------+
```

### Callers and Collaborators
- **Browser Adapter** (`packages/execution-core/src/adapters/browser/`): Calls `ArtifactManager.captureScreenshot`, `captureDomSnapshot`, `storeDownload`, and `storeBrowserTrace`.
- **Vision Subsystem** (`packages/execution-core/src/vision/`): Calls `ArtifactManager.storeOcrResult`.
- **Execution Runner** (`packages/execution-core/src/runner/`): Calls `ArtifactManager.storeExecutionReport` at task conclusion.
- **Runtime Context** (`packages/runtime-context/`): Ingests canonical artifact URIs as references within observation nodes, entity graphs, and timeline events without storing raw bytes.

---

## Architecture

The subsystem consists of three core components:

```
packages/execution-core/src/artifacts/
  |-- types.ts             # ArtifactType, ArtifactCategory, ArtifactMetadata, options
  |-- artifact-store.ts    # Low-level disk I/O, hashing, indexing, querying, and deletion
  `-- artifact-manager.ts  # High-level domain-specific capture methods and singleton lifecycle
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `ArtifactStore` | Core storage engine. Initializes directories, calculates SHA-256 hashes, writes physical files, records manifests to disk, maintains an in-memory two-key lookup table (`id` and `uri`), filters, exports, and deletes artifacts. |
| `ArtifactManager` | Facade and factory. Provides high-level helper methods (`captureScreenshot`, `captureDomSnapshot`, `storeDownload`, `storeOcrResult`, `storeBrowserTrace`, `storeExecutionReport`) with appropriate categorization, tags, and MIME types. Supports singleton access and custom store injection. |
| `types.ts` | Contract definitions for taxonomy, metadata interfaces, options, and query filters. |

---

## Core Concepts

### 1. Canonical Virtual URIs
Every artifact receives a unique, stable URI:
```
artifact://<executionId>/<category>/<fileName>
```
Example:
```
artifact://exec-8921-prod/screenshots/checkout-confirm-1725760000.png
```
This URI uniquely identifies the resource across all subsystems, network boundaries, and logging pipelines.

### 2. Categories vs. Types
The subsystem separates **Category** (directory structure and logical grouping) from **Type** (semantic data format):

- **Categories (`ArtifactCategory`)**:
  - `screenshots`: Viewport and full-page PNG/JPEG/WebP captures.
  - `downloads`: Binary and document files received via browser download events.
  - `uploads`: Local assets staged for form injection or file uploads.
  - `ocr`: Text recognition data and geometric bounding boxes.
  - `dom`: Accessibility trees and serialized DOM structures.
  - `html`: Raw page source snapshots.
  - `extracted`: Parsed structured data (JSON, CSV, tabular outputs).
  - `reports`: Task execution summaries and execution manifests.
  - `logs`: Diagnostic, console, and execution event logs.
  - `browser`: Playwright trace archives (`.zip`) and network HAR files.

- **Types (`ArtifactType`)**:
  - `screenshot`, `html`, `dom`, `ocr`, `download`, `upload`, `csv`, `json`, `pdf`, `trace`, `har`, `console_log`, `network_log`, `execution_log`, `user_attachment`.

### 3. Metadata Invariant
Every artifact created by the system produces an immutable `ArtifactMetadata` record:

```typescript
export interface ArtifactMetadata {
  id: string              // Unique ID, e.g. "art-1725760000000-a1b2c3"
  uri: string             // Canonical URI: artifact://<executionId>/<category>/<fileName>
  executionId: string     // Parent execution run ID
  taskId?: string         // Associated task ID within the execution
  capability?: string     // Capability that produced the asset (e.g. "browser")
  type: ArtifactType      // Semantic type
  mimeType: string        // Standard MIME type (e.g. image/png, application/zip)
  checksum: string        // Cryptographic SHA-256 hex digest
  size: number            // Exact file size in bytes
  createdAt: number       // Unix timestamp in milliseconds
  producer: string        // Component name (e.g. "browser-adapter")
  tags: string[]          // Custom taxonomy tags (e.g. ["viewport", "verification"])
  path: string            // Absolute local storage path on disk
}
```

---

## Data Flow

```
1. Caller Invocation
   ArtifactManager.captureScreenshot(executionId, taskId, buffer, fileName)
      |
      v
2. Store Option Construction
   SaveArtifactOptions { executionId, category: 'screenshots', content, ... }
      |
      v
3. Buffer Normalization & Digesting
   - Normalize string | Buffer | Uint8Array to Buffer
   - Compute SHA-256: crypto.createHash('sha256').update(buffer).digest('hex')
   - Measure size = buffer.length
   - Generate ID: "art-" + Date.now() + "-" + randomBytes(4).hex
      |
      v
4. Directory Provisioning
   ArtifactStore.initializeExecutionDir(executionId)
   -> mkdir -p <baseDir>/<executionId>/<category>
      |
      v
5. Physical File Persistence
   fs.writeFile(<baseDir>/<executionId>/<category>/<fileName>, buffer)
      |
      v
6. Indexing & Manifest Persistence
   - Set metadataCache.set(id, metadata)
   - Set metadataCache.set(uri, metadata)
   - Read/Append/Write <baseDir>/<executionId>/artifacts-meta.json
      |
      v
7. Metadata Return
   Return ArtifactMetadata to caller
```

---

## Public API

### `ArtifactStore`

Located in `packages/execution-core/src/artifacts/artifact-store.ts`.

#### Constructor
```typescript
constructor(customBaseDir?: string)
```
Initializes the store. If `customBaseDir` is not specified, defaults to `join(tmpdir(), 'usepilot-artifacts')`.

#### Core Methods

```typescript
// Physical base directory path
getBaseDir(): string

// Ensure execution directory and all 10 category folders exist on disk
initializeExecutionDir(executionId: string): Promise<string>

// Write content to disk, compute hash, index metadata, append to manifest
save(options: SaveArtifactOptions): Promise<ArtifactMetadata>

// Load artifact buffer and metadata from disk using either ID or canonical URI
load(identifier: string): Promise<{ buffer: Buffer; metadata: ArtifactMetadata }>

// Synchronously retrieve cached metadata by ID or URI without reading disk payload
getMetadata(identifier: string): ArtifactMetadata | undefined

// Filter metadata records by executionId, category, type, taskId, or tag
list(filter?: ListArtifactFilter): Promise<ArtifactMetadata[]>

// Delete file from disk and remove from metadata cache
delete(identifier: string): Promise<boolean>

// Copy artifact file from internal store to an external destination path
export(identifier: string, destinationPath: string): Promise<string>
```

---

### `ArtifactManager`

Located in `packages/execution-core/src/artifacts/artifact-manager.ts`.

#### Factory & Instance
```typescript
// Singleton accessor
static getInstance(): ArtifactManager

// Constructor with optional custom ArtifactStore injection
constructor(customStore?: ArtifactStore)

// Retrieve the underlying ArtifactStore instance
getStore(): ArtifactStore
```

#### Specialized Capture Methods

```typescript
// Capture screenshot buffer into 'screenshots' category (image/png)
captureScreenshot(
  executionId: string,
  taskId: string,
  screenshotBuffer: Buffer,
  fileName?: string
): Promise<ArtifactMetadata>

// Store raw DOM HTML string into 'dom' category (text/html)
captureDomSnapshot(
  executionId: string,
  taskId: string,
  htmlContent: string,
  fileName?: string
): Promise<ArtifactMetadata>

// Store browser downloaded file into 'downloads' category
storeDownload(
  executionId: string,
  taskId: string,
  fileName: string,
  content: Buffer
): Promise<ArtifactMetadata>

// Store OCR detection results as JSON into 'ocr' category
storeOcrResult(
  executionId: string,
  taskId: string,
  ocrJson: Record<string, unknown>,
  fileName?: string
): Promise<ArtifactMetadata>

// Store Playwright zip trace into 'browser' category (application/zip)
storeBrowserTrace(
  executionId: string,
  taskId: string,
  traceBuffer: Buffer,
  fileName?: string
): Promise<ArtifactMetadata>

// Store final execution report into 'reports' category
storeExecutionReport(
  executionId: string,
  reportJson: Record<string, unknown>,
  fileName?: string
): Promise<ArtifactMetadata>
```

#### Lifecycle & Maintenance Methods

```typescript
// List all artifacts for a given execution ID
getExecutionArtifacts(executionId: string): Promise<ArtifactMetadata[]>

// Calculate total storage bytes consumed across an execution or entire store
collectStorageUsageBytes(executionId?: string): Promise<number>

// Delete all artifacts and recursively remove execution directory on disk
purgeExecutionArtifacts(executionId: string): Promise<void>
```

---

## Internal Components

### 1. `CATEGORIES` Constant
A statically defined array of all ten categories:
`['screenshots', 'downloads', 'uploads', 'ocr', 'dom', 'html', 'extracted', 'reports', 'logs', 'browser']`.
When `initializeExecutionDir(executionId)` is called, all ten subfolders are created recursively.

### 2. `MIME_MAP` Extension Table
A lightweight internal lookup mapping standard file extensions (`png`, `jpg`, `webp`, `html`, `json`, `csv`, `txt`, `log`, `pdf`, `zip`, `har`) to official MIME strings. When `save()` is invoked without an explicit `mimeType`, `detectMimeType(fileName)` evaluates the filename suffix, defaulting to `application/octet-stream`.

### 3. Disk Manifest (`artifacts-meta.json`)
Every execution folder maintains an `artifacts-meta.json` file. Each call to `save()` appends the new `ArtifactMetadata` entry into this JSON file on disk. This guarantees that if the Node.js process restarts, metadata can be reconstructed by reading the manifest.

---

## Lifecycle

```
   +--------------------+
   | Execution Starts   |
   +--------------------+
             |
             v
   +---------------------------------------+
   | initializeExecutionDir(executionId)   |
   | - Creates <baseDir>/<execId>/<cat>/   |
   +---------------------------------------+
             |
             v
   +---------------------------------------+
   | Repeated save() / capture*() calls    |
   | - File written to disk                |
   | - SHA-256 computed                    |
   | - In-memory cache populated           |
   | - artifacts-meta.json appended        |
   +---------------------------------------+
             |
             v
   +---------------------------------------+
   | Execution Inspection / Verification   |
   | - list({ executionId })               |
   | - load(uri)                           |
   | - export(uri, destPath)               |
   +---------------------------------------+
             |
             v
   +---------------------------------------+
   | Execution Purge (Cleanup)             |
   | - purgeExecutionArtifacts(executionId)|
   | - Unlinks all files                   |
   | - Deletes cache entries               |
   | - Removes <baseDir>/<execId> tree     |
   +---------------------------------------+
```

---

## Error Handling

### 1. Missing Identifiers
When `load(identifier)` or `export(identifier)` is called with an unknown ID or URI, the store immediately throws an explicit error:
```typescript
throw new Error(`Artifact with identifier "${identifier}" not found`)
```
Callers must verify existence using `getMetadata(identifier)` or `list()` if presence is uncertain.

### 2. Idempotent Deletion
`delete(identifier)` returns `false` if the metadata is not found. If the metadata exists but the underlying file has already been unlinked by the operating system, the error is caught and suppressed, and the cache keys are cleaned up cleanly.

### 3. Best-Effort Disk Persistence
Writing to `artifacts-meta.json` is wrapped in a guarded try-catch block. If a disk write to the JSON manifest encounters permission issues or concurrent file locks, the main `save()` operation still succeeds, returning the valid in-memory `ArtifactMetadata` record.

---

## Design Tradeoffs

### 1. Virtual `artifact://` URIs vs. Absolute Filesystem Paths
Rather than exposing raw operating system paths (`C:\Users\Alice\AppData\...` or `/home/bob/...`), the subsystem abstracts all file access behind virtual URIs (`artifact://<executionId>/<category>/<fileName>`).
- **Tradeoff**: Masks sensitive local usernames and directory structures from cloud LLM contexts and logs, ensuring reproducible prompts and cross-platform portability.
- **Cost**: Requires URI resolution and mapping logic within `ArtifactStore`.

### 2. Category Partitioning vs. Task-Nested Trees
Instead of nesting files inside deep task subfolders (`/tasks/task-1/subtask-2/files/`), artifacts are partitioned into ten fixed top-level categories per execution (`/screenshots`, `/downloads`, `/ocr`, etc.).
- **Tradeoff**: Greatly simplifies bulk maintenance (e.g. purging all 100MB Playwright traces while keeping reports) and makes cross-task queries predictable.
- **Cost**: Filenames must be unique within an execution category (enforced via timestamped random nonces).

### 3. Disk-Backed Manifest (`artifacts-meta.json`) vs. SQLite Database
Metadata persistence uses an append-only JSON manifest per execution directory rather than an embedded database.
- **Tradeoff**: Zero binary native driver dependencies; human-readable and inspectable with standard CLI tools or text editors.
- **Cost**: Manifest writes require sequential read-append-write file operations.

---

## Invariants and Guarantees

1. **Checksum Immutability**: Every artifact file is hashed via SHA-256 during `save()`. The checksum recorded in `ArtifactMetadata` is immutable and matches the exact byte sequence on disk.
2. **Zero Memory Retention**: File content buffers (`Buffer`, `Uint8Array`) are released for garbage collection immediately after the `fs.writeFile` promise resolves.
3. **Dual-Key Lookup**: Every cached artifact is accessible by both its unique ID (`art-...`) and its canonical URI (`artifact://...`) in O(1) time.
4. **Partition Exclusivity**: Artifacts are strictly scoped to an `executionId`. Purging an execution deletes only that run's directory tree, leaving adjacent runs unaffected.

---

## Failure Modes and Recovery

| Failure Scenario | Detection | Automated Recovery | Non-Goals (What It Won't Do) |
|---|---|---|---|
| **Missing File on Disk** | `fs.readFile()` throws `ENOENT` | `load()` rejects with explicit missing identifier error. | Does not attempt to regenerate lost artifacts. |
| **Manifest Write Lock** | `fs.writeFile()` throws during meta update | Catches error; returns in-memory metadata successfully. | Does not fail the entire task if manifest JSON write stalls. |
| **Disk Space Exhaustion** | Node.js `ENOSPC` exception | Rejects `save()` with filesystem error to abort task cleanly. | Does not automatically purge other executions without explicit call. |
| **Tampered File Content** | Verifier re-computes SHA-256 | Verification fails with condition mismatch. | Does not overwrite modified files automatically. |

---

## Things To Avoid

- **Do NOT leak physical filesystem paths to planner prompts.** Always pass virtual `artifact://` URIs to LLMs, planners, and journal entries. Physical paths expose user environments and break deterministic replay.
- **Do NOT manually delete files inside the artifact directory.** Direct file deletion desynchronizes the in-memory metadata cache and `artifacts-meta.json`. Use `artifactStore.delete(identifier)` or `purgeExecutionArtifacts(executionId)`.
- **Do NOT retain artifact buffers in component state.** Buffers for 4K screenshots or Playwright traces consume significant RAM. Retain only `ArtifactMetadata` and call `artifactStore.load(uri)` on demand.
- **Do NOT invent ad-hoc categories.** Stick to the ten canonical categories in `ArtifactCategory`. Adding unmapped categories breaks directory provisioning.

---

## Thread Safety and Concurrency

- **Directory Provisioning Lock**: `ArtifactStore` maintains an in-memory `initializedDirs = new Set<string>()`. The recursive filesystem `mkdir` operations are performed only once per execution ID per process lifecycle.
- **Cache Dual-Keying**: The in-memory `metadataCache` stores each record under two keys: `metadata.id` and `metadata.uri`. Queries by either key resolve in O(1) time without iteration.
- **Concurrent Writes**: Distinct artifacts have distinct timestamps and random hex suffixes (`art-<timestamp>-<randomHex>`), preventing filename collisions when concurrent tasks write artifacts simultaneously.

---

## Performance Characteristics

| Operation | Complexity | Characteristics |
| :--- | :--- | :--- |
| `getMetadata(id \| uri)` | O(1) | In-memory `Map` lookup; zero filesystem I/O. |
| `save(options)` | O(N) where N = buffer byte length | Single sequential SHA-256 hash stream and disk file write. Payload is not held in RAM. |
| `list(filter)` | O(M) where M = total cached artifacts | Set deduplication and predicate filtering over cached metadata entries. |
| `load(identifier)` | O(1) lookup + O(N) disk read | Retrieves path from cache, then executes `fs.readFile`. |
| `collectStorageUsageBytes()` | O(M) | Linear sum over `size` metadata fields; does not stat disk files. |

---

## Testing Strategy

Artifact subsystem tests are located in `packages/execution-core/test/artifacts.test.ts` (or executed via unit test runners in `packages/execution-core`):

- **Directory Creation**: Verifies that `initializeExecutionDir` creates all ten category folders.
- **Integrity Validation**: Verifies that saving known string/buffer data produces the exact expected SHA-256 digest and matching byte length.
- **URI Resolution**: Verifies that loading by ID (`art-...`) and loading by canonical URI (`artifact://...`) return identical byte buffers and metadata.
- **Filtering**: Validates filtering by execution ID, category, artifact type, task ID, and tags.
- **Purge Verification**: Confirms that calling `purgeExecutionArtifacts` unlinks all physical files, empties the cache, and deletes the directory tree.

---

## Extension Guide

### Adding a New Artifact Category

1. Open `packages/execution-core/src/artifacts/types.ts`.
2. Add the category literal to `ArtifactCategory`:
   ```typescript
   export type ArtifactCategory =
     | 'screenshots'
     // ...
     | 'audio_captures' // new category
   ```
3. In `packages/execution-core/src/artifacts/artifact-store.ts`, add the category name to the internal `CATEGORIES` array:
   ```typescript
   const CATEGORIES: ArtifactCategory[] = [
     // ...
     'audio_captures',
   ]
   ```
4. If appropriate, add helper capture methods to `ArtifactManager`.

### Adding a New File Extension / MIME Mapping

Update `MIME_MAP` in `packages/execution-core/src/artifacts/artifact-store.ts`:
```typescript
const MIME_MAP: Record<string, string> = {
  // ...
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
}
```

---

## Directory Layout

### Codebase Source Structure
```
packages/execution-core/src/artifacts/
├── types.ts             # Type contracts and metadata structures
├── artifact-store.ts    # Low-level storage engine, hashing, and cache
└── artifact-manager.ts  # High-level domain helper methods and lifecycle management
```

### Runtime Storage Layout on Disk
```
<customBaseDir or os.tmpdir()>/usepilot-artifacts/
└── <executionId>/
    ├── artifacts-meta.json  # Complete manifest of all artifacts in this run
    ├── screenshots/        # e.g., screenshot-1725760001234.png
    ├── downloads/          # e.g., monthly-invoice.pdf
    ├── uploads/            # Form payload staging files
    ├── ocr/                # e.g., ocr-1725760002100.json
    ├── dom/                # e.g., dom-1725760001500.html
    ├── html/               # Raw source HTML snapshots
    ├── extracted/          # Parsed CSV / JSON exports
    ├── reports/            # execution-report.json
    ├── logs/               # Execution trace logs
    └── browser/            # trace-1725760003000.zip, network.har
```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Binary Asset File** | `ArtifactStore` | Producers (Adapters, Verifiers) | Replay, UI, Exporters | Execution run (until purged) | Saved to `~/.usepilot/artifacts/<runId>/` |
| **Artifact Metadata** | `ArtifactStore` | `save()`, `updateMetadata()` | Indexer, Replay, Planner | Execution run | Serialized to `artifacts-meta.json` |
| **Hot Metadata Cache** | `ArtifactStore` | In-memory operations | `get()`, `list()` queries | Node process lifetime | Synchronized from disk manifest |

---

## Failure Assumptions

1. **Storage Availability**: Assumes local host disk space is available. If disk space is exhausted (`ENOSPC`), write operations fail with clear error codes rather than hanging.
2. **Crash Interruption**: Assumes process termination can occur mid-write. Atomic temporary file swaps guarantee partially written files never overwrite or corrupt existing artifacts.
3. **No External Deletions**: Assumes external operating system processes or antivirus cleaners do not delete intermediate files while an execution run is actively writing.

---

## Common Extension Points

- **Adding a New Artifact Category**: Add the category key to `ArtifactCategory` union in `packages/execution-types/src/artifacts.ts`. The partitioned directory topology and validator automatically adjust.
- **Custom MIME Type Resolvers**: Extend the extension-to-MIME lookup table in `packages/execution-core/src/artifacts/mime-types.ts` to support specialized file formats.
- **Custom Post-Processing Pipelines**: Register completion hooks on `ArtifactManager` to trigger compression, thumbnail generation, or encryption.

---

## Examples

### 1. Capturing a Screenshot from a Browser Adapter
```typescript
import { ArtifactManager } from '@usepilot/execution-core'

const artifactManager = ArtifactManager.getInstance()

const screenshotBuffer = await page.screenshot({ fullPage: true })
const metadata = await artifactManager.captureScreenshot(
  'exec-901',
  'task-checkout-page',
  screenshotBuffer,
  'checkout-view.png'
)

console.log(metadata.uri)
// "artifact://exec-901/screenshots/checkout-view.png"
console.log(metadata.checksum)
// "a3f4e2...d9"
```

### 2. Saving Custom Extracted Data
```typescript
import { ArtifactStore } from '@usepilot/execution-core'

const store = new ArtifactStore()

const csvContent = 'id,name,amount\n1,Enterprise,12000\n2,Standard,4000\n'

const artifact = await store.save({
  executionId: 'exec-901',
  taskId: 'task-parse-table',
  category: 'extracted',
  fileName: 'pricing-table.csv',
  content: csvContent,
  type: 'csv',
  mimeType: 'text/csv',
  producer: 'table-parser',
  tags: ['billing', 'export'],
})

console.log(`Saved artifact: ${artifact.id} (${artifact.size} bytes)`)
```

### 3. Querying and Exporting Artifacts
```typescript
import { ArtifactStore } from '@usepilot/execution-core'

const store = new ArtifactStore()

// Find all screenshots with the 'verification' tag for an execution
const screenshots = await store.list({
  executionId: 'exec-901',
  category: 'screenshots',
  tag: 'verification',
})

for (const meta of screenshots) {
  console.log(`Found: ${meta.uri} - ${meta.size} bytes`)
  // Export to customer-visible folder
  await store.export(meta.uri, `./exports/${meta.id}.png`)
}
```

### 4. Cleaning Up at Execution Conclusion
```typescript
import { ArtifactManager } from '@usepilot/execution-core'

const manager = ArtifactManager.getInstance()

const bytesUsed = await manager.collectStorageUsageBytes('exec-901')
console.log(`Execution used ${bytesUsed} bytes of disk space`)

// Purge execution artifacts after archiving
await manager.purgeExecutionArtifacts('exec-901')
```

---

## Related Documentation

- [Browser Subsystem Documentation](../browser/README.md) - Browser adapter screenshot and trace generation.
- [Runtime Context Documentation](../runtime-context/README.md) - Context engine references to virtual artifact URIs.
- [Vision Subsystem Documentation](../vision/README.md) - OCR bounding box and visual snapshot artifact production.
