# Runtime Diagnostics Subsystem

Runtime Diagnostics (`@usepilot/execution-core/src/diagnostics`) aggregates operational health, resource leak detection, performance metrics, and chronological timelines across execution capabilities, correlating journal events directly with generated artifacts.

---

## Purpose

Automated execution engines coordinate multiple volatile external systems: browser child processes, filesystem file descriptors, native operating system clipboard hooks, OCR workers, and cryptographic key vaults. Without centralized, structured diagnostics:
- Dangling browser pages and worker processes accumulate silently, exhausting host memory.
- Intermittent adapter errors go unnoticed until complete subsystem failure occurs.
- Post-execution debugging requires manually stitching together disjointed log files, journal events, and disk files.
- Execution slowdowns cannot be attributed accurately between adapter runtime, verification overhead, self-healing recovery, or human authorization gates.

The Runtime Diagnostics Subsystem owns:
- Continuous health monitoring and state classification (`healthy`, `degraded`, `unhealthy`) across six core subsystems.
- Resource lifecycle tracking and leak detection with severity levels (`low`, `medium`, `high`) and automated disposal fallback.
- Chronological forensic timeline synthesis linking low-level journal entries directly to high-level artifact URIs.
- Execution-wide performance profiling covering CPU deltas, peak heap usage, approval wait latency, and per-adapter breakdown.

The Runtime Diagnostics Subsystem intentionally does NOT own:
- Execution scheduling, retry policies, or plan generation.
- Action execution or capability dispatch (delegated to capability adapters).
- UI dashboard rendering (delegated to Tauri/React desktop application).

---

## Design Principles

### 1. Unified Forensic Timeline
Logs in isolation do not explain why an automation step failed. A journal entry stating that a click timed out is far more actionable when cross-referenced against the exact DOM snapshot, console error stream, and network failure that occurred at the same millisecond. The diagnostics subsystem synthesizes journal events and artifact metadata into an immutable, chronologically ordered sequence of `TimelineEvent` records.

### 2. Active Leak Detection with Recovery Hooks
Tracking resources (such as Playwright contexts, open file handles, or Tesseract OCR worker threads) is insufficient if the system cannot recover from omissions. Every tracked resource can register an optional `disposeHandler?: () => Promise<void> | void`. When resources exceed age thresholds (e.g. 30s, 60s, 120s), the leak detector generates warnings and can proactively invoke the cleanup handlers to restore stability.

### 3. Separation of Execution from Diagnostics Overhead
Health queries, metric aggregations, and timeline builds operate in-memory using lightweight counters and hash maps. Collecting performance metrics or logging events does not block ongoing adapter I/O or introduce measurable latency into the critical execution loop.

---

## Where It Fits

The Runtime Diagnostics Subsystem is located in `packages/execution-core/src/diagnostics/` and provides observability across all adapters and runtime components.

```
+--------------------------------------------------------------------+
|                         Execution Engine                           |
+--------------------------------------------------------------------+
       |                              |                         |
       | Record tasks & timings       | Track allocations       | Record status
       v                              v                         v
+--------------------------+  +----------------------+  +---------------------+
| PerformanceMetrics       |  | ResourceLeakDetector |  | RuntimeHealth       |
| Collector                |  |                      |  | Monitor             |
|  - CPU & Heap Peaks      |  |  - Active Contexts   |  |  - Failure Counters |
|  - Per-Task Breakdown    |  |  - Age Thresholds    |  |  - Degraded Status  |
|  - Approval Delays       |  |  - Automated Dispose |  |  - Subsystem Health |
+--------------------------+  +----------------------+  +---------------------+
       |                                                        |
       | Finish run                                             | Get report
       v                                                        v
 [ExecutionSummary]                                     [SystemHealthReport]
                               \                       /
                                v                     v
                        +-------------------------------------+
                        |     DiagnosticTimelineBuilder       |
                        |  - Merges Journal + Artifacts       |
                        |  - Outputs Unified Timeline Events  |
                        +-------------------------------------+
                                          |
                                          v
                              [Diagnostic Timeline]
                              (Desktop UI / Reports)
```

### Callers and Collaborators
- **Execution Runner**: Injects `PerformanceMetricsCollector` per execution run and records task start, verification duration, and approval pauses.
- **Adapters (Browser, Vision, Filesystem)**: Register and release allocated resources via `ResourceLeakDetector.track()` and `release()`.
- **Journal & Artifact Store**: Provide source event arrays and metadata records to `DiagnosticTimelineBuilder.fromJournalAndArtifacts()`.
- **Desktop Application** (`apps/desktop/`): Reads `SystemHealthReport` and timeline streams to render the diagnostics and debug screens.

---

## Architecture

```
packages/execution-core/src/diagnostics/
├── health-types.ts           # SubsystemHealthState, HealthStatus, SystemHealthReport, warnings
├── health-monitor.ts         # RuntimeHealthMonitor tracking subsystem availability and failures
├── leak-detector.ts          # ResourceLeakDetector tracking active handles and aged leaks
├── performance-collector.ts  # PerformanceMetricsCollector aggregating CPU, RAM, and durations
└── diagnostic-timeline.ts    # DiagnosticTimelineBuilder assembling chronologically sorted events
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `RuntimeHealthMonitor` | Evaluates the health status (`healthy`, `degraded`, `unhealthy`) of Browser, Filesystem, Desktop, Vision, Vault, and Permissions subsystems based on failure counts and active resource states. |
| `ResourceLeakDetector` | Singleton registry tracking active allocations (`browser_context`, `browser_page`, `file_handle`, `adapter_session`, `ocr_worker`) by age. Dispatches leak warnings and triggers cleanup handlers. |
| `PerformanceMetricsCollector` | Instance created per execution run. Tracks process memory peaks, CPU usage deltas, verification latency, and produces structured performance summaries. |
| `DiagnosticTimelineBuilder` | Merges raw execution journal entries with artifact metadata into a unified chronological event list for auditing and visualization. |

---

## Core Concepts

### 1. Subsystem Health Classification
Each subsystem is classified into one of three states:
- `healthy`: Subsystem is operating within normal parameters.
- `degraded`: Subsystem is functional, but experiencing elevated failures (e.g. >5 browser failures or >3 filesystem failures) or contains aged resources.
- `unhealthy`: Subsystem is completely unavailable, uninitialized, or experiencing unrecoverable errors.

The overall system status mirrors the worst subsystem state.

### 2. Resource Leak Lifecycle and Severity
When a long-lived resource is instantiated, the allocating component registers it with `ResourceLeakDetector.track()`. When closed cleanly, `ResourceLeakDetector.release()` removes it from tracking.

If a resource remains unreleased, `detectLeaks(maxAgeSeconds)` evaluates its age:
- **Low Severity** (`age >= 30s`): Normal for long-running workflows, logged for tracking.
- **Medium Severity** (`age >= 60s`): Resource likely orphaned by an unhandled exception.
- **High Severity** (`age >= 120s`): Confirmed leak; automatically degrades system health status.

### 3. Chronological Forensic Timeline
A execution produces disparate data streams:
1. **Journal Entries**: Lightweight structured event objects (`execution_started`, `task_completed`, `verification_result`, `approval_requested`).
2. **Artifact Metadata**: Binary and textual outputs saved to disk with canonical URIs (`screenshot`, `download`, `upload`, `dom`).

`DiagnosticTimelineBuilder` normalizes these into a uniform `TimelineEvent` schema with unified statuses (`success`, `failed`, `warning`, `info`), duration timestamps, and direct references to artifacts.

---

## Data Flow

```
1. Resource Allocation
   BrowserAdapter opens new BrowserContext
      |
      +---> ResourceLeakDetector.track(contextId, 'browser_context', 'browser-adapter', disposeFn)
      |
2. Execution Step
   PerformanceCollector.recordTask({ taskId, durationMs, verificationDurationMs, ... })
   HealthMonitor.recordExecution('browser', success: true)
      |
3. Resource Disposal
   BrowserAdapter closes BrowserContext
      |
      +---> ResourceLeakDetector.release(contextId)
      |
4. Execution Completion
   - PerformanceCollector.finish() -> ExecutionPerformanceSummary
   - DiagnosticTimelineBuilder.fromJournalAndArtifacts(execId, journalEntries, artifacts)
      |
      v
5. Timeline Output
   Sorted array of TimelineEvent records returned to UI and diagnostic reports
```

---

## Public API

### `RuntimeHealthMonitor`

Located in `packages/execution-core/src/diagnostics/health-monitor.ts`.

#### Factory & Constructor
```typescript
static getInstance(): RuntimeHealthMonitor
constructor(leakDetector?: ResourceLeakDetector)
```

#### Core Methods
```typescript
// Record execution outcome for a subsystem
recordExecution(subsystem: string, success: boolean, recovered?: boolean): void

// Query health of individual subsystems
getBrowserHealth(): HealthStatus
getFilesystemHealth(): HealthStatus
getDesktopHealth(): HealthStatus
getVisionHealth(): HealthStatus
getVaultHealth(): HealthStatus
getPermissionsHealth(): HealthStatus

// Generate consolidated system health report
getSystemReport(): SystemHealthReport
```

---

### `ResourceLeakDetector`

Located in `packages/execution-core/src/diagnostics/leak-detector.ts`.

#### Factory
```typescript
static getInstance(): ResourceLeakDetector
```

#### Core Methods
```typescript
// Register an allocated resource
track(
  id: string,
  type: TrackedResourceType,
  allocatedBy: string,
  disposeHandler?: (() => Promise<void> | void) | undefined
): void

// Deregister a freed resource
release(id: string): boolean

// Count currently active resources by type or globally
getActiveCount(type?: TrackedResourceType): number

// Scan for resources exceeding age threshold (default 30 seconds)
detectLeaks(maxAgeSeconds?: number): ResourceLeakWarning[]

// Execute all registered disposeHandlers for active resources and clear registry
cleanupAllLeakedResources(): Promise<number>
```

---

### `PerformanceMetricsCollector`

Located in `packages/execution-core/src/diagnostics/performance-collector.ts`.

#### Constructor
```typescript
constructor(executionId: string)
```

#### Core Methods
```typescript
// Append metrics for a completed task
recordTask(record: TaskPerformanceRecord): void

// Finalize measurement, calculate CPU and memory peaks, and compile summary
finish(): ExecutionPerformanceSummary
```

---

### `DiagnosticTimelineBuilder`

Located in `packages/execution-core/src/diagnostics/diagnostic-timeline.ts`.

#### Core Methods
```typescript
// Manually append a timeline event
addEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent

// Merge execution journal entries and artifact records into a chronological timeline
fromJournalAndArtifacts(
  executionId: string,
  journalEntries: JournalEntry[],
  artifacts: ArtifactMetadata[]
): TimelineEvent[]

// Retrieve accumulated events sorted by timestamp
getEvents(): TimelineEvent[]
```

---

## Internal Components

### 1. `TrackedResourceType` Union
Strict enumeration of all system resources managed by the leak detector:
`'browser_context' | 'browser_page' | 'file_handle' | 'adapter_session' | 'ocr_worker'`.

### 2. CPU and Memory Sampling
In `PerformanceMetricsCollector`:
```typescript
private memoryPeak = process.memoryUsage().heapUsed
private startCpuUsage = process.cpuUsage()
```
When `recordTask` is invoked, `process.memoryUsage().heapUsed` is sampled. If the current heap exceeds `memoryPeak`, the peak is updated. On `finish()`, `process.cpuUsage(this.startCpuUsage)` computes exact user and system microseconds spent on behalf of the execution run.

---

## Lifecycle

```
[Application Startup]
       |
       +---> RuntimeHealthMonitor initialized (singleton)
       +---> ResourceLeakDetector initialized (singleton)
       |
[Execution Run Begins]
       |
       +---> new PerformanceMetricsCollector(executionId)
       |
[Tasks Executing]
       |
       +---> Resources tracked / released via ResourceLeakDetector
       +---> Failures and successes recorded via HealthMonitor
       +---> Completed task metrics pushed to PerformanceCollector
       |
[Execution Concludes]
       |
       +---> PerformanceCollector.finish() -> ExecutionPerformanceSummary
       +---> TimelineBuilder merges Journal + Artifacts
       +---> Aged resource audit -> cleanupAllLeakedResources()
```

---

## Error Handling

### 1. Defensive Health Checks
Health evaluation methods never throw exceptions. If subsystem parameters cannot be read or child processes are unreachable, the subsystem degrades gracefully to `'degraded'` or `'unhealthy'` status with appropriate diagnostic details.

### 2. Best-Effort Leak Disposal
In `cleanupAllLeakedResources()`, if an individual resource's `disposeHandler()` rejects or throws an error, the exception is caught and ignored:
```typescript
try {
  await record.disposeHandler()
  cleaned++
} catch {
  // Best effort disposal
}
```
The detector removes the record from its internal map regardless, preventing cleanup cascades from hanging the runtime.

---

## Design Tradeoffs

### 1. In-Process Lifecycle Registry vs. External OS Scraping
Rather than relying on OS-level process monitors or pgrep scripts to find orphaned browser engines or worker threads, the subsystem tracks allocations in-process via `ResourceLeakDetector.track()`.
- **Tradeoff**: Associates allocating components (`allocatedBy`), allocation timestamps, and custom asynchronous `disposeHandler` callbacks directly with the resource, enabling proactive automated recovery.
- **Cost**: Requires adapters to cooperate by calling `track()` and `release()`.

### 2. Unified Forensic Timeline vs. Disjoint Log Streams
Instead of leaving execution journals, verification records, and artifact manifests in separate files, `DiagnosticTimelineBuilder` compiles them into a single, strictly sorted chronological event list.
- **Tradeoff**: Engineers can correlate a task failure with the exact screenshot URI and console error that occurred at the same millisecond without manual log cross-referencing.
- **Cost**: Requires an in-memory chronological sorting pass (`O(M log M)`) at execution conclusion.

---

## Invariants and Guarantees

1. **Non-Throwing Monitoring**: `getSystemReport()` and subsystem health queries never throw uncaught exceptions. If an internal measurement fails, the status degrades to `'degraded'` or `'unhealthy'`.
2. **Leak Severity Escalation**: Resources are classified deterministically by age: `>= 30s` (low), `>= 60s` (medium), `>= 120s` (high). Any high-severity leak automatically marks `overallStatus = 'degraded'`.
3. **Safe Disposal Guarantee**: `cleanupAllLeakedResources()` executes all registered `disposeHandler` callbacks inside isolated try-catch blocks. A failure in one disposal handler will not prevent remaining leaked resources from being cleaned up.
4. **Timeline Monotonicity**: Events returned by `fromJournalAndArtifacts()` and `getEvents()` are guaranteed to be sorted by timestamp in ascending order.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Diagnostic Engine Response | Automated Recovery |
|---|---|---|---|
| **Dangling Browser Context** | Age exceeds 30s in leak detector | Generates `ResourceLeakWarning` with severity based on age. | `cleanupAllLeakedResources()` invokes registered context `close()`. |
| **Elevated Subsystem Errors** | Subsystem failures exceed threshold (>5 browser, >3 fs) | Sets subsystem status to `'degraded'`. | Alerts self-healing pipeline to trigger adapter session reset. |
| **Uncaught Dispose Error** | Exception inside `disposeHandler()` | Catches error; increments cleaned count and removes record. | Prevents resource tracking map from permanently leaking. |
| **High Memory Heap Spike** | `process.memoryUsage()` sample | High-water mark recorded in `memoryPeakBytes`. | Informs context tiering manager to execute cache sweep. |

---

## Things To Avoid

- **Do NOT allocate long-lived resources without calling `leakDetector.track()`.** Any browser page, context, file handle, or worker created outside normal scopes must be tracked so leaks are detectable.
- **Do NOT forget to call `release()` on clean teardown.** Leaving closed resources in the detector causes false-positive leak warnings and degraded health reports.
- **Do NOT throw unhandled exceptions in `disposeHandler`.** While the leak detector catches errors defensively, clean disposal handlers ensure operating system handles are closed cleanly.
- **Do NOT use Date.now() for durations.** Use `Date.now() - startedAt` or `process.cpuUsage(startCpu)` to ensure duration calculations remain accurate.

---

## Thread Safety and Concurrency

- **Synchronous Map Modifications**: `ResourceLeakDetector` and `RuntimeHealthMonitor` update in-memory JavaScript `Map` collections synchronously. Because Node.js executes JavaScript on a single thread, race conditions in map updates do not occur.
- **Execution Instance Isolation**: `PerformanceMetricsCollector` is instantiated per execution run. Multiple parallel executions run separate collectors without shared state.

---

## Performance Characteristics

| Operation | Complexity | Overhead |
| :--- | :--- | :--- |
| `ResourceLeakDetector.track` | O(1) | Sub-microsecond Map insertion. |
| `ResourceLeakDetector.release` | O(1) | Sub-microsecond Map deletion. |
| `ResourceLeakDetector.detectLeaks` | O(N) where N = active resources | Linear iteration over active resource records (typically < 100). |
| `HealthMonitor.getSystemReport` | O(1) | Reads memory counters and simple integer thresholds. |
| `TimelineBuilder.fromJournalAndArtifacts` | O(M log M) where M = events + artifacts | Linear transformation followed by an in-memory chronological array sort. |

---

## Testing Strategy

Diagnostics tests are located in `packages/execution-core/test/diagnostics.test.ts`:

- **Leak Thresholds**: Verifies that resources older than 30s, 60s, and 120s are flagged with correct leak severities.
- **Dispose Cleanup**: Asserts that `cleanupAllLeakedResources()` invokes registered dispose handlers and empties the resource registry.
- **Health State Transitions**: Verifies that accumulating failure counters transitions subsystem status from `healthy` to `degraded`.
- **Timeline Ordering**: Feeds unsorted journal entries and artifact records to `DiagnosticTimelineBuilder` and verifies the returned array is strictly sorted by timestamp.

---

## Extension Guide

### Adding a New Tracked Resource Type

1. Update `TrackedResourceType` in `packages/execution-core/src/diagnostics/health-types.ts`:
   ```typescript
   export type TrackedResourceType =
     | 'browser_context'
     | 'browser_page'
     | 'file_handle'
     | 'adapter_session'
     | 'ocr_worker'
     | 'database_connection' // new resource
   ```
2. In the component allocating the resource, call `ResourceLeakDetector.getInstance().track(id, 'database_connection', 'db-adapter', () => conn.close())`.

---

## Directory Layout

```
packages/execution-core/src/diagnostics/
├── health-types.ts           # Types, statuses, and interfaces
├── health-monitor.ts         # RuntimeHealthMonitor
├── leak-detector.ts          # ResourceLeakDetector
├── performance-collector.ts  # PerformanceMetricsCollector
└── diagnostic-timeline.ts    # DiagnosticTimelineBuilder
```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Resource Registry** | `ResourceLeakDetector` | `track()`, `release()` | Health Monitor, Sweeper | Node process runtime | In-memory map |
| **Subsystem Health Status** | `RuntimeHealthMonitor` | Status update callers | Diagnostics, UI | Process runtime | Polled periodically |
| **Forensic Timeline** | `ExecutionTimelineBuilder` | Built from Journal + Artifacts | Replay Engine, UI | Post-execution analysis | Transient memory projection |

---

## Failure Assumptions

1. **Handler Safety**: Assumes registered resource `disposeHandler` functions do not throw unhandled exceptions or hang indefinitely during active leak sweeps.
2. **Clock Monotonicity**: Assumes wall-clock timestamps (`Date.now()`) progress monotonically for event ordering and age threshold evaluations.
3. **In-Memory Volatility**: Assumes diagnostics registry state is ephemeral and resets cleanly across process restarts.

---

## Common Extension Points

- **Registering a Custom Resource Type**: Add a new `ResourceType` string literal in `packages/execution-core/src/diagnostics/resource-leak-detector.ts` and specify customized warning age thresholds.
- **Adding a New Subsystem Health Probe**: Register new health check functions in `RuntimeHealthMonitor.recordStatus()` to integrate external telemetry sources.

---

## Examples

### 1. Tracking a Browser Context for Leaks
```typescript
import { ResourceLeakDetector } from '@usepilot/execution-core'

const detector = ResourceLeakDetector.getInstance()
const contextId = 'ctx-tab-12'

// Track allocation
detector.track(
  contextId,
  'browser_context',
  'browser-adapter',
  async () => {
    await browserContext.close()
  }
)

// When closed normally
detector.release(contextId)
```

### 2. Inspecting System Health
```typescript
import { RuntimeHealthMonitor } from '@usepilot/execution-core'

const healthMonitor = RuntimeHealthMonitor.getInstance()
const report = healthMonitor.getSystemReport()

console.log('Overall Status:', report.overallStatus)
console.log('Browser Status:', report.subsystems.browser.status)
console.log('Active Leak Warnings:', report.activeLeakWarnings.length)
```

### 3. Collecting Execution Performance Metrics
```typescript
import { PerformanceMetricsCollector } from '@usepilot/execution-core'

const collector = new PerformanceMetricsCollector('exec-101')

collector.recordTask({
  taskId: 'task-1',
  capability: 'navigate_website',
  adapterId: 'PlaywrightBrowserAdapter',
  durationMs: 450,
  verificationDurationMs: 12,
  retries: 0,
  healingAttempts: 0,
  approvalWaitMs: 0,
  artifactsCount: 1,
})

const summary = collector.finish()
console.log('Total Duration:', summary.totalDurationMs, 'ms')
console.log('Peak Heap Memory:', summary.memoryPeakBytes, 'bytes')
console.log('Average Navigation Time:', summary.capabilityBreakdown['navigate_website'].avgDurationMs, 'ms')
```

---

## Related Documentation

- [Browser Subsystem Documentation](../browser/README.md) - Browser context and page lifecycle management.
- [Runtime Health Monitoring Documentation](../health/README.md) - Context engine and graph health evaluations.
- [Performance Documentation](../performance/README.md) - Execution performance tracking and bottleneck analysis.
- [Tracing Subsystem Documentation](../tracing/README.md) - Browser trace zip creation and event capture.
