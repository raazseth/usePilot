# Runtime Performance Subsystem

Runtime Performance (`@usepilot/execution-core/src/diagnostics/performance-collector`) profiles execution runs, isolating latency bottlenecks between adapter actions, verification overhead, self-healing recovery, and human approval wait times.

---

## Purpose

Automated workflows are composed of multiple distinct phases: model planning, adapter dispatch, browser/network I/O, independent verification, self-healing remediation, and human-in-the-loop approvals. When a workflow experiences degradation, engineering teams must know:
- Did the delay occur in the browser page load or in human approval wait time?
- How much time was spent verifying disk and DOM postconditions?
- Did self-healing recovery succeed quickly, or did it dominate execution time?
- Which capabilities or adapters are the slowest on average?
- Did memory consumption spike during high-resolution screenshot or PDF processing?

The Runtime Performance Subsystem owns:
- Per-task timing attribution (`durationMs`, `verificationDurationMs`, `approvalWaitMs`).
- Resilience overhead metrics (`retries`, `healingAttempts`).
- Artifact volume accounting (`artifactsCount`, `artifactsProducedTotal`).
- Operating system resource instrumentation (user/system CPU microseconds converted to milliseconds, peak heap memory usage).
- Aggregated capability and adapter performance breakdowns (`count`, `avgDurationMs`).
- Production of the immutable `ExecutionPerformanceSummary`.

The Runtime Performance Subsystem intentionally does NOT own:
- Execution scheduling or task dispatching.
- Alerting or metric transport to remote APM systems (such as Datadog or Prometheus).
- Resource throttling or rate limiting.

---

## Design Principles

### 1. Granular Latency Partitioning
Measuring only total execution duration obscures where time is actually spent. A task taking 30 seconds might have completed its browser actions in 500ms, spent 200ms verifying the DOM, and waited 29.3 seconds for a user to click "Approve". The performance collector records these dimensions independently, ensuring delays are attributed to their root cause.

### 2. Zero-Dependency Process Sampling
Instead of relying on heavy external profiling agents, the subsystem uses native Node.js process instrumentation primitives (`process.memoryUsage().heapUsed` and `process.cpuUsage()`). This allows performance tracking to run continuously in production with sub-microsecond overhead and zero external dependencies.

### 3. Capability and Adapter Attribution
Automations frequently use multiple adapters for different capabilities. The collector generates two orthogonal breakdowns:
1. **Capability Breakdown**: Highlights inherently slow operations (e.g. `download_file` vs. `read_clipboard`).
2. **Adapter Breakdown**: Isolates adapter-specific overhead (e.g. `PlaywrightBrowserAdapter` vs. `NativeFilesystemAdapter`).

---

## Where It Fits

The Runtime Performance Subsystem resides in `packages/execution-core/src/diagnostics/performance-collector.ts` and is instantiated by the execution runner at the start of each execution run.

```
+------------------------------------------------------------------------+
|                            Execution Runner                            |
+------------------------------------------------------------------------+
       |                                                    |
       | 1. Instantiates collector                          | 2. Dispatches tasks
       v                                                    v
+-----------------------------+               +--------------------------+
| PerformanceMetricsCollector |               |    Task Execution Loop   |
+-----------------------------+               +--------------------------+
       ^                                                    |
       |                                                    | 3. Measure phases:
       |                                                    |    - Task action
       | 4. recordTask(record)                              |    - Verification
       +----------------------------------------------------+    - Self-healing
       |                                                    |    - Approval wait
       | 5. Execution completes                             |    - Artifact count
       v                                                    v
+-----------------------------+
|    finish() Compilation     |
+-----------------------------+
       |
       | Calculates CPU delta, peak RAM,
       | and capability/adapter averages
       v
+------------------------------------------------------------------------+
|                     ExecutionPerformanceSummary                        |
|  - totalDurationMs, cpuTimeMs, memoryPeakBytes                         |
|  - retriesTotal, healingTotal, approvalWaitMsTotal                     |
|  - capabilityBreakdown & adapterBreakdown                              |
+------------------------------------------------------------------------+
```

### Callers and Collaborators
- **Execution Runner**: Injects `PerformanceMetricsCollector` per execution run, tracks timestamps, and invokes `recordTask()`.
- **Capability Adapters**: Provide execution durations.
- **Verification Engine**: Measures and supplies `verificationDurationMs`.
- **Self-Healing Pipeline**: Tracks retry counts and healing attempts.
- **Approval Gate**: Tracks time spent waiting for human input (`approvalWaitMs`).
- **Artifact Manager**: Counts generated artifacts per task.

---

## Architecture

```
packages/execution-core/src/diagnostics/
  `-- performance-collector.ts   # TaskPerformanceRecord, ExecutionPerformanceSummary, collector class
```

### Component Roles

| Structure | Responsibility |
| :--- | :--- |
| `TaskPerformanceRecord` | Metric tuple recorded per task execution, capturing duration, verification, retries, healing, approval delay, and artifact output. |
| `ExecutionPerformanceSummary` | Consolidated execution manifest containing aggregate statistics, resource peaks, and breakdown tables. |
| `PerformanceMetricsCollector` | State machine capturing start CPU/memory, recording task metrics, and compiling the final summary. |

---

## Core Concepts

### 1. Task Performance Dimensions

```typescript
export interface TaskPerformanceRecord {
  taskId: string
  capability: string
  adapterId: string
  durationMs: number
  verificationDurationMs: number
  retries: number
  healingAttempts: number
  approvalWaitMs: number
  artifactsCount: number
}
```

- `durationMs`: Net time spent executing the primary capability action in the adapter.
- `verificationDurationMs`: Time consumed by independent state verification (inspecting DOM, statting disk, computing SHA-256).
- `retries`: Number of execution attempts prior to success.
- `healingAttempts`: Number of self-healing strategies attempted.
- `approvalWaitMs`: Wall-clock time during which execution was suspended awaiting human approval.
- `artifactsCount`: Number of artifacts produced by this task.

### 2. High-Water-Mark Memory Tracking
Rather than recording periodic memory snapshots that miss short-lived spikes, `recordTask()` samples `process.memoryUsage().heapUsed` after every task completion. If the observed heap exceeds the previous maximum, `memoryPeak` is updated. This guarantees that peak memory consumption is recorded accurately even if garbage collection reclaims the memory before execution concludes.

### 3. CPU Delta Computation
At initialization, `process.cpuUsage()` records the baseline CPU user and system microseconds. Upon completion, `process.cpuUsage(this.startCpuUsage)` computes the exact CPU time consumed by the process during the execution run, converted to milliseconds:
```typescript
const cpuDiff = process.cpuUsage(this.startCpuUsage)
const cpuTimeMs = Math.round((cpuDiff.user + cpuDiff.system) / 1000)
```

---

## Data Flow

```
1. Execution Run Starts
   collector = new PerformanceMetricsCollector('exec-202')
   - startedAt = Date.now()
   - memoryPeak = process.memoryUsage().heapUsed
   - startCpuUsage = process.cpuUsage()
      |
      v
2. Task Step Finishes
   collector.recordTask({
     taskId: 'task-auth',
     capability: 'navigate_website',
     adapterId: 'PlaywrightBrowserAdapter',
     durationMs: 820,
     verificationDurationMs: 15,
     retries: 0,
     healingAttempts: 0,
     approvalWaitMs: 0,
     artifactsCount: 1
   })
   - Appends to taskRecords[]
   - Updates memoryPeak if current heap > memoryPeak
      |
      v
3. Repeat for All Tasks in Execution
      |
      v
4. Execution Completes
   summary = collector.finish()
   - Compute totalDurationMs = Date.now() - startedAt
   - Compute cpuTimeMs via process.cpuUsage diff
   - Sum retries, healing, verification duration, approval wait
   - Compute capabilityBreakdown (count and avgDurationMs)
   - Compute adapterBreakdown (count and avgDurationMs)
      |
      v
5. Deliver Summary
   Return ExecutionPerformanceSummary to logs, reports, and UI
```

---

## Public API

### `PerformanceMetricsCollector`

Located in `packages/execution-core/src/diagnostics/performance-collector.ts`.

#### Constructor
```typescript
constructor(executionId: string)
```
Initializes the collector for an execution run. Starts internal timers, records baseline CPU usage, and initializes the memory peak.

#### Methods

```typescript
// Record performance metrics for a completed task
recordTask(record: TaskPerformanceRecord): void

// Finalize measurement and compile the complete execution performance summary
finish(): ExecutionPerformanceSummary
```

---

### Data Contracts

#### `ExecutionPerformanceSummary`
```typescript
export interface ExecutionPerformanceSummary {
  executionId: string
  totalDurationMs: number
  taskCount: number
  retriesTotal: number
  healingTotal: number
  verificationDurationMsTotal: number
  approvalWaitMsTotal: number
  memoryPeakBytes: number
  cpuTimeMs: number
  artifactsProducedTotal: number
  tasks: TaskPerformanceRecord[]
  capabilityBreakdown: Record<string, { count: number; avgDurationMs: number }>
  adapterBreakdown: Record<string, { count: number; avgDurationMs: number }>
}
```

---

## Internal Components

### 1. Breakdown Aggregators
In `finish()`, two internal accumulators compute totals and averages:
```typescript
const capTotals: Record<string, { count: number; totalDuration: number }> = {}
const adapterTotals: Record<string, { count: number; totalDuration: number }> = {}

for (const t of this.taskRecords) {
  // ... accumulate sums
}

for (const [cap, data] of Object.entries(capTotals)) {
  capabilityBreakdown[cap] = {
    count: data.count,
    avgDurationMs: Math.round(data.totalDuration / data.count),
  }
}
```
This produces clean, normalized summary tables ready for JSON serialization and frontend display.

---

## Design Tradeoffs

### 1. Granular Phase Partitioning vs. Single Duration Timestamp
Rather than recording a single wall-clock duration per task, `TaskPerformanceRecord` breaks latency into:
- Adapter action duration (`durationMs`)
- Independent verification duration (`verificationDurationMs`)
- Self-healing recovery time (`healingAttempts`)
- Human approval wait time (`approvalWaitMs`)
- **Tradeoff**: Distinguishes true automation bottlenecks (e.g. slow DOM rendering) from human pauses (e.g. user taking 5 minutes to approve a prompt), ensuring SLAs reflect machine execution speed accurately.
- **Cost**: Requires adapters and runners to measure multiple sub-phase timestamps.

### 2. Native Process Instrumentation vs. Continuous Profiler Threads
The collector samples Node.js native primitives (`process.memoryUsage().heapUsed` and `process.cpuUsage()`) at task boundaries rather than spawning a continuous sampling profiler thread.
- **Tradeoff**: Introduces sub-microsecond CPU overhead and zero memory allocation during steady-state execution.
- **Cost**: Does not capture call-stack traces or function-level flamegraphs.

---

## Invariants and Guarantees

1. **Monotonic Peak Memory**: `memoryPeakBytes` is non-decreasing. It records the highest heap watermark observed during any task completion in the run.
2. **Deterministic CPU Accounting**: User and system CPU microseconds are measured strictly across the execution interval (`process.cpuUsage(startCpu)`), unaffected by clock adjustments or NTP sync.
3. **Preserved Order**: Tasks recorded via `recordTask()` appear in `summary.tasks` in exact chronological execution order.
4. **Resilient Early Finalization**: If an execution aborts or fails midway, calling `finish()` immediately yields an accurate partial performance summary of all completed tasks.

---

## Failure Modes and Recovery

| Failure Scenario | Detection | Collector Behavior | Downstream Effect |
|---|---|---|---|
| **Early Execution Abort** | Run aborted or cancelled | `finish()` can be called at any point | Produces valid summary for tasks completed prior to abort. |
| **Negative Duration Anomaly** | Clock skew / NTP shift | Durations clamped to `>= 0` | Prevents negative averages in capability breakdown. |
| **Zero-Task Execution** | `taskRecords.length === 0` | Returns 0 totals and empty breakdown tables | Does not throw divide-by-zero errors in averages. |

---

## Things To Avoid

- **Do NOT combine human approval wait time with task execution duration.** Always record `approvalWaitMs` separately; otherwise, agent performance metrics will appear artificially degraded when users are away from keyboard.
- **Do NOT pass cumulative run time to `durationMs`.** `durationMs` must measure only the discrete task's execution interval.
- **Do NOT mutate `ExecutionPerformanceSummary` after `finish()`.** The returned object is an immutable audit record intended for persistence and reporting.

---

## Lifecycle

```
[Execution Starts]
        |
        v
[new PerformanceMetricsCollector(executionId)]
        |
        v
[Loop over Blueprint Tasks]
   - Execute Task
   - Verify State
   - recordTask(record)
        |
        v
[Execution Ends]
        |
        v
[collector.finish()]
        |
        v
[Summary Archived via ArtifactManager.storeExecutionReport()]
```

---

## Error Handling

The performance collector operates purely on immutable primitive values and in-memory arrays. It does not perform network requests or disk I/O, ensuring that failure in another subsystem cannot disrupt metric collection. If an execution aborts or encounters an unhandled rejection, calling `finish()` immediately yields a valid, partial performance summary up to the point of failure.

---

## Thread Safety and Concurrency

- **Instance Encapsulation**: A `PerformanceMetricsCollector` instance is created per execution run. Multiple executions running concurrently in the same Node.js process maintain completely separate task arrays and baseline measurements.
- **Process CPU Shared Scope**: `process.cpuUsage()` measures CPU time across the entire Node.js process. When multiple executions run concurrently, CPU time reflects aggregate process utilization.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `new PerformanceMetricsCollector()` | O(1) | < 10 microseconds. |
| `recordTask()` | O(1) | Single array push + `process.memoryUsage()` call (~1 microsecond). |
| `finish()` | O(T) where T = task count | Single pass over task records (~50 microseconds for 1,000 tasks). |

---

## Testing Strategy

Tests reside in `packages/execution-core/test/performance-collector.test.ts`:

- **Metric Aggregation**: Feeds known `TaskPerformanceRecord` tuples and verifies that totals (`retriesTotal`, `healingTotal`, `verificationDurationMsTotal`) equal expected arithmetic sums.
- **Averaging Precision**: Validates that capability and adapter averages are calculated properly and rounded to integer milliseconds.
- **Peak Memory Tracking**: Asserts that `memoryPeakBytes` is at least as large as the initial heap measurement and reflects memory growth.
- **CPU Time Measurement**: Executes a synthetic computation loop and confirms `cpuTimeMs` registers a positive non-zero value.

---

## Extension Guide

### Adding New Performance Dimensions

To track an additional metric (such as network payload bytes or token usage):

1. Add the field to `TaskPerformanceRecord` in `packages/execution-core/src/diagnostics/performance-collector.ts`:
   ```typescript
   export interface TaskPerformanceRecord {
     // ... existing fields
     tokenUsage?: number | undefined
   }
   ```
2. Add the corresponding total in `ExecutionPerformanceSummary`:
   ```typescript
   export interface ExecutionPerformanceSummary {
     // ... existing fields
     tokenUsageTotal: number
   }
   ```
3. Update the loop in `finish()` to accumulate the metric.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Collector Instance** | Execution Runner | `recordTask()` | Diagnostics, UI | Execution run duration | Destroyed after `finish()` |
| **`ExecutionPerformanceSummary`** | Execution Runner | `finish()` | Database, Post-mortem reports | Indefinite | Persisted with run record |
| **Recorded Task Metrics** | `PerformanceMetricsCollector` | Internal array push | `finish()` aggregator | Run duration | Aggregated into summary |

---

## Failure Assumptions

1. **Deterministic Microsecond Accounting**: Assumes Node's `process.cpuUsage()` and `performance.now()` provide reliable microsecond-resolution monotonic time intervals.
2. **Process Scope Constraints**: Assumes `process.cpuUsage()` and `process.memoryUsage()` sample entire Node.js process state; in multi-tenant environments, CPU reflects aggregate host process utilization.
3. **Finite Task Runs**: Assumes individual execution plans contain a finite number of tasks (<10,000), allowing task records to reside in RAM during run.

---

## Common Extension Points

- **Adding a Performance Dimension**: Extend `TaskPerformanceMetrics` in `packages/execution-core/src/diagnostics/performance-collector.ts` (e.g. tracking token usage or network bandwidth) and accumulate in `finish()`.
- **Custom Telemetry Exporters**: Implement hooks in `finish()` to stream serialized performance summaries to OpenTelemetry or local disk reports.

---

## Directory Layout

```
packages/execution-core/src/diagnostics/
  `-- performance-collector.ts   # Core performance collector and summary schemas
```

---

## Examples

### 1. Tracking Task Performance in an Execution Runner
```typescript
import { PerformanceMetricsCollector } from '@usepilot/execution-core'

const collector = new PerformanceMetricsCollector('exec-run-500')

// Task 1: Navigation
collector.recordTask({
  taskId: 'task-nav',
  capability: 'navigate_website',
  adapterId: 'PlaywrightBrowserAdapter',
  durationMs: 420,
  verificationDurationMs: 10,
  retries: 0,
  healingAttempts: 0,
  approvalWaitMs: 0,
  artifactsCount: 1,
})

// Task 2: File Download
collector.recordTask({
  taskId: 'task-dl',
  capability: 'download_file',
  adapterId: 'PlaywrightBrowserAdapter',
  durationMs: 1450,
  verificationDurationMs: 25,
  retries: 1,
  healingAttempts: 1,
  approvalWaitMs: 0,
  artifactsCount: 1,
})

const summary = collector.finish()
console.log(`Execution completed in ${summary.totalDurationMs} ms`)
console.log(`Verification overhead: ${summary.verificationDurationMsTotal} ms`)
console.log(`Self-healing attempts: ${summary.healingTotal}`)
```

### 2. Inspecting Capability Averages
```typescript
const summary = collector.finish()

for (const [capability, data] of Object.entries(summary.capabilityBreakdown)) {
  console.log(`Capability: ${capability}`)
  console.log(`  Executions: ${data.count}`)
  console.log(`  Average Duration: ${data.avgDurationMs} ms`)
}
```

---

## Related Documentation

- [Runtime Diagnostics Documentation](../diagnostics/README.md) - System health, resource leaks, and event timelines.
- [Browser Subsystem Documentation](../browser/README.md) - Browser adapter execution performance.
- [Runtime Context Health Monitoring](../health/README.md) - Context engine and graph health metrics.
