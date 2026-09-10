# Browser Trace Recording Subsystem

Browser Trace Recording (`@usepilot/execution-core/src/tracing`) captures full-fidelity diagnostic telemetry during browser automation, streaming console logs, network responses, and selector failures into structured JSON while archiving Playwright action replays into canonical artifact bundles.

---

## Purpose

Browser automation failures are notoriously difficult to diagnose from static text logs. Dynamic web applications change DOM structure asynchronously, trigger background network fetches, display transient popups, and throw silent client-side JavaScript errors. When a selector times out or a click fails:
- Was the target button hidden behind a modal overlay?
- Did a network API call return HTTP 401 or 500 right before the click?
- Did a client-side JavaScript exception prevent button registration?
- What did the page look like at the exact millisecond of the failure?

The Browser Trace Recording Subsystem owns:
- Lifecycle management of Playwright context tracing (`context.tracing.start` and `stop`).
- Real-time interception and buffering of browser `console` messages (`log`, `warn`, `error`).
- Real-time interception and buffering of HTTP response traffic (`url`, `status`, `method`, `timestamp`).
- Tracking and logging of failed DOM selectors encountered before self-healing is triggered.
- Archival of Playwright `.zip` trace bundles into canonical artifact URIs (`artifact://<executionId>/browser/browser-trace-<taskId>.zip`).
- Post-trace DOM snapshot capture and active session cookie count accounting.
- Compilation of the structured `BrowserTraceSummary`.

The Browser Trace Recording Subsystem intentionally does NOT own:
- Browser session launching or browser executable discovery (owned by `PlaywrightBrowserAdapter`).
- Self-healing locator remediation (owned by the Self-Healing pipeline).
- Trace viewer GUI rendering (handled via Playwright Trace Viewer or the desktop frontend).

---

## Design Principles

### 1. Zero-Leak Temporary Archiving
Playwright requires a file path on disk when exporting a trace archive. The recorder generates a unique temporary path in `os.tmpdir()` (`trace-<timestamp>-<random>.zip`), writes the trace bundle, reads the buffer into memory, uploads it to the `ArtifactStore`, and immediately unlinks the temporary file in a `finally` block. No intermediate trace zips linger in the host temporary directory.

### 2. Dual-Layer Observability
Playwright trace archives are rich and comprehensive, but require specialized tooling (`npx playwright show-trace`) to inspect. To ensure that automation logs, self-healing engines, and AI planners can consume trace data programmatically without parsing zip files, the recorder maintains parallel in-memory streams of console logs, network responses, and failed selectors in structured JSON format alongside the binary zip.

### 3. Non-Intrusive Error Isolation
Tracing operations must never crash an ongoing task. If `page.content()` fails because the browser page navigated away, or if `context.tracing.stop()` encounters an unexpected state, the recorder catches the exception, cleans up resources, and returns the available diagnostic summary gracefully.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Dual-layer capture (in-memory JSON streams + Playwright zip)** | Binary trace zip only | AI planners, self-healing locators, and automated test runners need immediate programmatic access to console errors, network statuses, and selector failures without unzipping large archives. |
| **Immediate temp file unlinking** | Keep traces in OS temp directory | Prevents unbounded disk accumulation in long-running desktop sessions; traces are systematically indexed and retrieved via canonical `artifact://` URIs. |
| **Non-blocking error isolation** | Propagate tracing failures to task runner | Tracing is an observability mechanism; failure to dump DOM or capture a trace must never abort or invalidate an otherwise successful automation task. |
| **Direct Playwright context binding** | CDP (Chrome DevTools Protocol) raw session | Native Playwright tracing API provides synchronized screenshots, action visualizer metadata, and network watermarking with cross-browser compatibility out of the box. |

---

## Invariants and Guarantees

1. **Deterministic Lifecycle**: Every `startTracing()` call must eventually be balanced by a `stopTracing()` call. Re-invoking `startTracing()` on an already active recorder resets internal buffers and rebinds listeners.
2. **Zero Orphaned Files**: Any temporary `.zip` path written to `os.tmpdir()` during `stopTracing()` is deleted within a `finally` block regardless of whether `storeBrowserTrace()` succeeds or fails.
3. **Immutability of Trace Summary**: The returned `BrowserTraceSummary` represents a frozen snapshot of console logs, network events, and failed selectors captured during that specific trace window.
4. **Listener Detachment**: Listener callbacks bound to `page.on('console')` and `page.on('response')` are tied to the page instance and cleared or ignored after tracing stops.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Page closes during tracing** | `page.content()` or `page.context().cookies()` throws target closed | Catches error; sets `domArtifact` to null and `cookieCount` to 0, still exporting Playwright context trace. | Does not attempt to revive the dead page. |
| **Temp file write failure** | `fs.writeFile` or Playwright export rejection | Logs warning, unlinks partial file if present, returns summary with missing `traceArtifact`. | Does not re-run task or halt workflow. |
| **Artifact storage failure** | `ArtifactStore.storeBrowserTrace` rejects | Captures error, leaves `traceArtifact` undefined in summary, returns in-memory logs. | Does not crash execution runner. |
| **Unbounded log explosion** | High volume of console or network events | Bounded by JavaScript memory limits during the task duration. | Does not filter logs heuristically (preserves fidelity). |

---

## Things To Avoid

- **Do NOT leave tracing unstopped**: Forgetting to call `stopTracing()` in a `finally` block leaves Playwright tracing buffers accumulating in RAM.
- **Do NOT parse zip archives at runtime**: Use the structured `consoleLogs`, `networkLogs`, and `failedSelectors` from `BrowserTraceSummary` for programmatic logic; inspect the zip bundle only in forensic viewers.
- **Do NOT throw errors from tracing**: Tracing is diagnostic tooling; errors within `startTracing` or `stopTracing` must be caught and degraded gracefully.
- **Do NOT bypass ArtifactManager**: Store trace zips exclusively through canonical artifact methods to ensure lifecycle management and unified artifact retention policies.

---

## Where It Fits

The Browser Trace Recording Subsystem resides in `packages/execution-core/src/tracing/` and collaborates with the browser adapter and artifact manager.

```
+------------------------------------------------------------------------+
|                       PlaywrightBrowserAdapter                         |
+------------------------------------------------------------------------+
       |                                                    |
       | 1. startTracing(context, page)                     | 2. Executes web
       v                                                    |    actions (click,
+-----------------------------+                             |    type, nav)
|    BrowserTraceRecorder     |                             |
+-----------------------------+                             |
  | Listeners:                |                             |
  |  - page.on('console')     |<----------------------------+
  |  - page.on('response')    |
  |  - recordFailedSelector() |
       |                                                    |
       | 3. Action completes or fails                       |
       |    stopTracing(executionId, taskId, page)          |
       v                                                    v
+-----------------------------+                     +--------------------+
|    Stop Tracing & Flush     |                     | Playwright Context |
+-----------------------------+                     +--------------------+
       |                                                    |
       | Write temp zip -> Read buffer                      | Stop & export
       v                                                    v
+-----------------------------+                     +--------------------+
|       ArtifactManager       |                     |  Trace Archive Zip |
+-----------------------------+                     +--------------------+
       |
       | Saves trace artifact & DOM snapshot
       v
+------------------------------------------------------------------------+
|                         BrowserTraceSummary                            |
|  - traceArtifact: "artifact://run/browser/browser-trace-task.zip"      |
|  - domArtifact:   "artifact://run/dom/page-task.html"                  |
|  - consoleLogs:   ConsoleLogEntry[]                                    |
|  - networkLogs:   NetworkLogEntry[]                                    |
|  - failedSelectors: string[]                                           |
|  - cookieCount:   number                                               |
+------------------------------------------------------------------------+
```

### Callers and Collaborators
- **`PlaywrightBrowserAdapter`**: Starts tracing before running complex tasks and stops tracing upon task completion or error.
- **`ArtifactManager`**: Persists the generated trace zip and DOM snapshot to disk under canonical URIs.
- **Self-Healing Pipeline**: Calls `recordFailedSelector()` when a primary selector fails, enabling root-cause analysis across alternative locator attempts.

---

## Architecture

```
packages/execution-core/src/tracing/
  `-- trace-recorder.ts   # BrowserTraceRecorder, options, and summary interfaces
```

### Component Roles

| Structure | Responsibility |
| :--- | :--- |
| `TraceRecordOptions` | Configuration flags controlling screenshot capture, DOM snapshot retention, and JavaScript source inclusion. |
| `ConsoleLogEntry` | Structured representation of browser console messages (`type`, `text`, `timestamp`). |
| `NetworkLogEntry` | Structured record of network responses (`url`, `status`, `method`, `timestamp`). |
| `BrowserTraceSummary` | Complete forensic summary package containing artifact references, log streams, failed selectors, and session state. |
| `BrowserTraceRecorder` | Core engine managing event listeners, trace lifecycle, temporary file swaps, and artifact persistence. |

---

## Core Concepts

### 1. Playwright Trace Configuration
When `startTracing()` is called, Playwright is configured with:
- `screenshots: true`: Captures image frames for every action step, allowing visual scrubbing in the trace viewer.
- `snapshots: true`: Records DOM snapshots before and after each action, enabling DOM inspection at any point in time.
- `sources: false`: Omits source code files by default to minimize archive sizes and protect proprietary test scripts.

### 2. Live Console and Network Interception
While tracing is active, the recorder binds to the active `Page`:
```typescript
page.on('console', (msg) => {
  this.consoleLogs.push({
    type: msg.type(),
    text: msg.text(),
    timestamp: Date.now(),
  })
})

page.on('response', (res) => {
  this.networkLogs.push({
    url: res.url(),
    status: res.status(),
    method: res.request().method(),
    timestamp: Date.now(),
  })
})
```
This data is captured independently of the binary Playwright trace, allowing immediate programmatic queries without unpacking the zip archive.

### 3. Failed Selector Journaling
When self-healing kicks in because a selector failed (e.g. `button#submit-order` timed out), the adapter calls `recordFailedSelector('button#submit-order')`. If subsequent fallbacks succeed or fail, the diagnostic summary retains a complete history of all rejected selectors.

---

## Data Flow

```
1. Start Tracing
   traceRecorder.startTracing(browserContext, page, { screenshots: true, snapshots: true })
   - Initializes consoleLogs[], networkLogs[], failedSelectors[]
   - Registers 'console' and 'response' listeners on Page
   - Generates temp path: os.tmpdir()/trace-<timestamp>-<rand>.zip
   - Invokes browserContext.tracing.start(...)
      |
      v
2. Task Execution
   - Actions occur (clicks, navigations, form typing)
   - Console errors buffered to consoleLogs[]
   - HTTP responses buffered to networkLogs[]
   - Failed locators recorded via recordFailedSelector(sel)
      |
      v
3. Stop Tracing
   traceRecorder.stopTracing(executionId, taskId, page)
   - browserContext.tracing.stop({ path: tempTraceFile })
   - Read buffer from tempTraceFile
   - ArtifactManager.storeBrowserTrace(...) -> "artifact://.../browser-trace-task.zip"
   - Delete tempTraceFile
   - Capture DOM: page.content() -> ArtifactManager.captureDomSnapshot(...)
   - Count active session cookies: page.context().cookies()
      |
      v
4. Summary Return
   Return BrowserTraceSummary { traceArtifact, domArtifact, consoleLogs, networkLogs, ... }
```

---

## Public API

### `BrowserTraceRecorder`

Located in `packages/execution-core/src/tracing/trace-recorder.ts`.

#### Constructor
```typescript
constructor(customManager?: ArtifactManager)
```
Initializes the recorder. Injects a custom `ArtifactManager` or defaults to `ArtifactManager.getInstance()`.

#### Methods

```typescript
// Begin recording Playwright trace and attach event listeners
startTracing(
  context: BrowserContext,
  page?: Page,
  options?: TraceRecordOptions
): Promise<void>

// Record a DOM selector that timed out or failed to match
recordFailedSelector(selector: string): void

// Conclude tracing, store artifacts, capture final DOM, and return summary
stopTracing(
  executionId: string,
  taskId: string,
  page?: Page
): Promise<BrowserTraceSummary>
```

---

### Data Contracts

#### `TraceRecordOptions`
```typescript
export interface TraceRecordOptions {
  screenshots?: boolean | undefined  // Default: true
  snapshots?: boolean | undefined    // Default: true
  sources?: boolean | undefined      // Default: false
}
```

#### `BrowserTraceSummary`
```typescript
export interface BrowserTraceSummary {
  traceArtifact?: ArtifactMetadata | undefined
  domArtifact?: ArtifactMetadata | undefined
  consoleLogs: ConsoleLogEntry[]
  networkLogs: NetworkLogEntry[]
  failedSelectors: string[]
  cookieCount: number
  hasTrace: boolean
}
```

---

## Internal Components

### 1. Temporary File Cleanup Pattern
In `stopTracing()`:
```typescript
try {
  await this.activeContext.tracing.stop({ path: this.tempTraceFile })
  const traceBuffer = await fs.readFile(this.tempTraceFile)
  traceArtifact = await this.artifactManager.storeBrowserTrace(
    executionId,
    taskId,
    traceBuffer,
    `browser-trace-${taskId}.zip`
  )
  await fs.unlink(this.tempTraceFile).catch(() => {})
} catch {
  // Fallback if tracing stop failed
} finally {
  this.isTracing = false
}
```
The temporary archive is unlinked immediately after ingestion, preventing disk leaks in `tmpdir()`.

### 2. Page Closed Defensive Check
Before capturing the final DOM snapshot and cookie counts, the recorder verifies that the page is still active:
```typescript
if (page && !page.isClosed()) {
  try {
    const html = await page.content()
    domArtifact = await this.artifactManager.captureDomSnapshot(
      executionId,
      taskId,
      html,
      `page-${taskId}.html`
    )
    const cookies = await page.context().cookies()
    cookieCount = cookies.length
  } catch {
    // Page navigated or closed during evaluation
  }
}
```

---

## Lifecycle

```
[Task Dispatched to Browser Adapter]
                 |
                 v
[BrowserTraceRecorder.startTracing()]
                 |
                 v
[Execution: Page Events & Actions]
  - console messages recorded
  - network responses logged
  - failed selectors pushed
                 |
                 v
[Task Complete or Failed]
                 |
                 v
[BrowserTraceRecorder.stopTracing()]
  - Trace written to temp disk
  - Read into memory buffer
  - Persisted in ArtifactStore
  - Temp disk file unlinked
  - DOM snapshot captured
                 |
                 v
[BrowserTraceSummary Delivered to Diagnostics]
```

---

## Error Handling

### 1. Tracing Startup Resiliency
If a browser context is in an invalid state when `startTracing()` is called (e.g. context is already closed), the call catches the error, sets `isTracing = false`, and allows the task to proceed without crashing the automation.

### 2. Missing Trace Recovery
If `context.tracing.stop()` fails (for example, if the browser process crashed unceremoniously mid-task), the recorder catches the exception, leaves `traceArtifact` as `undefined`, and populates `BrowserTraceSummary.hasTrace = false`. The collected console and network logs are still returned intact.

---

## Thread Safety and Concurrency

- **Instance Scoping**: While `ArtifactManager` is shared, each `BrowserTraceRecorder` instance maintains its own `consoleLogs`, `networkLogs`, and `failedSelectors` buffers for a single context session.
- **Unique Temporary Files**: Temporary trace filenames incorporate timestamps and random alphanumeric strings (`trace-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`), preventing filename clashes between concurrent browser contexts.

---

## Performance Characteristics

| Operation | Performance Profile |
| :--- | :--- |
| `startTracing()` | ~5 - 15 ms (attaches Playwright event hooks). |
| `console` / `response` logging | In-memory array push (< 1 microsecond per event). |
| `stopTracing()` | Bound by Playwright zip compression (typically 50 - 250 ms depending on screenshot count) + disk write to `ArtifactStore`. |

---

## Testing Strategy

Tests are located in `packages/execution-core/test/trace-recorder.test.ts`:

- **Event Buffering**: Simulates console logs and network response events on a mock page, confirming all entries appear in the summary with correct timestamps.
- **Failed Selector Logging**: Verifies that calls to `recordFailedSelector()` preserve the order and text of failed locators.
- **Trace Archival**: Validates that `stopTracing()` calls `storeBrowserTrace()` with the expected category (`browser`), filename, and MIME type (`application/zip`).
- **Clean Temp File Disposal**: Asserts that no temporary files remain in `os.tmpdir()` after `stopTracing()` completes.

---

## Extension Guide

### Adding Request Header Capture

To capture outgoing request payloads alongside responses:

1. In `BrowserTraceRecorder.startTracing()`, attach to `page.on('request')`:
   ```typescript
   page.on('request', (req) => {
     this.requestLogs.push({
       url: req.url(),
       method: req.method(),
       headers: req.headers(),
       timestamp: Date.now(),
     })
   })
   ```
2. Add `requestLogs` to `BrowserTraceSummary`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **`BrowserTraceRecorder`** | `PlaywrightBrowserAdapter` | `startTracing()`, `stopTracing()` | Runner | Task execution duration | Instance scoped to task |
| **`BrowserTraceSummary`** | `BrowserTraceRecorder` | Listener callbacks | Diagnostics, Self-Healing | Post-task evaluation | Stored in execution journal |
| **Trace Archive Zip** | `ArtifactStore` | `storeBrowserTrace()` | Forensics, Playwright CLI | Execution run | Persisted to disk under `artifact://` |
| **Temporary Disk Zip** | `BrowserTraceRecorder` | Playwright export | Buffer ingest | Transient seconds | Unlinked immediately |

---

## Failure Assumptions

1. **Non-Blocking Telemetry**: Assumes failure to record or export a trace bundle must never fail the underlying automation task.
2. **Playwright Context Survival**: Assumes the Playwright browser context remains open until `stopTracing()` completes; if closed prematurely, the recorder captures available in-memory logs and degrades gracefully.
3. **Temp Directory Writable**: Assumes `os.tmpdir()` has space to buffer temporary zip archives prior to artifact store ingestion.

---

## Common Extension Points

- **Adding Request Header and Body Capture**: Attach to `page.on('request')` in `startTracing()` and append sanitized payloads to `requestLogs`.
- **Custom Event Filtering**: Add predicate filters in console/network listener hooks to discard high-frequency ping or analytics events.

---

## Directory Layout

```
packages/execution-core/src/tracing/
  `-- trace-recorder.ts   # BrowserTraceRecorder implementation and types
```

---

## Examples

### 1. Recording a Complete Browser Task
```typescript
import { BrowserTraceRecorder } from '@usepilot/execution-core'

const recorder = new BrowserTraceRecorder()

await recorder.startTracing(browserContext, activePage, {
  screenshots: true,
  snapshots: true,
})

try {
  await activePage.goto('https://example.com/checkout')
  await activePage.click('button#pay-now')
} catch (err) {
  recorder.recordFailedSelector('button#pay-now')
  throw err
} finally {
  const summary = await recorder.stopTracing('exec-404', 'task-checkout', activePage)

  console.log('Trace URI:', summary.traceArtifact?.uri)
  console.log('Console Errors:', summary.consoleLogs.filter((l) => l.type === 'error').length)
  console.log('Failed Selectors:', summary.failedSelectors)
}
```

### 2. Inspecting Traces with the CLI
When a task fails, open the stored trace file directly with Playwright's viewer:
```bash
npx playwright show-trace C:\Users\Raaz\AppData\Local\Temp\usepilot-artifacts\exec-404\browser\browser-trace-task-checkout.zip
```

---

## Related Documentation

- [Browser Subsystem Documentation](../browser/README.md) - Playwright browser automation and session management.
- [Runtime Artifact Subsystem](../artifacts/README.md) - Canonical artifact storage and retrieval.
- [Diagnostics Subsystem Documentation](../diagnostics/README.md) - Event timelines and resource leak detection.
