# Runtime Context Health Monitoring

Context Health Monitoring (`@usepilot/runtime-context/src/health`) evaluates operational integrity, freshness, and success rates across all memory, graph, and perception layers within Runtime Context, synthesizing knowledge metrics into a structured telemetry report.

---

## Purpose

The runtime context maintains the agent's internal mental model of the environment. Over long-running execution sessions or across multiple tasks, context subsystems can degrade in ways that do not trigger hard crashes:
- Discovered web domains in the Browser Graph may exceed their time-to-live (TTL) and become completely stale.
- Execution Memory may record a plummeting task success rate indicating systemic environment failure.
- The Runtime Index may fail to ingest generated downloads or OCR output.
- The Observation Engine may cease receiving perception nodes from the browser and desktop adapters.

The Runtime Context Health Monitoring subsystem owns:
- Health status evaluation (`healthy`, `degraded`, `unhealthy`) across all six runtime context subsystems.
- Freshness auditing of discovered web domain topologies in the Browser Graph.
- Success rate calculation across the trailing 50 task executions in Execution Memory.
- Metric aggregation across document indexes, entity counts, relationship edges, and observation logs.
- Generation of the composite `RuntimeContextHealthReport`.

The Runtime Context Health Monitoring subsystem intentionally does NOT own:
- Low-level adapter process monitoring or OS process health (owned by `RuntimeHealthMonitor` in `packages/execution-core`).
- Cache invalidation or entity pruning algorithms (owned by the respective storage engines).
- UI dashboard rendering (delegated to the desktop frontend).

---

## Design Principles

### 1. Holistic Context Validation
Evaluating whether an agent is healthy requires inspecting the state of its knowledge, not just whether process handles are open. If all known web navigation routes are expired or recent task executions are failing at an elevated rate, the agent is operating in a degraded context state even if memory and CPU usage are low.

### 2. Zero-Side-Effect Polling
Health inspections must never alter the state they observe. `RuntimeContextHealthMonitor` performs purely non-mutating queries: reading array lengths, querying cached index maps, and calculating ratio percentages. Generating a health report causes zero disk writes, zero database flushes, and zero lock contention.

### 3. Graceful Status Composition
Subsystem statuses are evaluated individually and rolled up into a global `overallStatus`. An issue in a single peripheral subsystem (such as stale web graphs or high task failure rates) degrades the composite status to `'degraded'`, alerting operators and self-healing systems without prematurely aborting healthy tasks.

---

## Where It Fits

The Runtime Context Health Monitoring subsystem resides in `packages/runtime-context/src/health/` and is injected with the core context dependencies during facade initialization.

```
+-------------------------------------------------------------------------+
|                          RuntimeContextFacade                           |
+-------------------------------------------------------------------------+
                                     |
                                     | Instantiates with dependencies
                                     v
+-------------------------------------------------------------------------+
|                     RuntimeContextHealthMonitor                         |
+-------------------------------------------------------------------------+
     |             |             |             |             |          |
     v             v             v             v             v          v
+---------+  +-----------+  +----------+  +----------+  +--------+ +--------+
|Knowledge|  |  Runtime  |  | Observ-  |  | Browser  |  |Execut- | | Entity |
|  Store  |  |   Index   |  |  ation   |  |  Graph   |  |  ion   | | Graph  |
|         |  |           |  |  Engine  |  |          |  | Memory | |        |
+---------+  +-----------+  +----------+  +----------+  +--------+ +--------+
     |             |             |             |             |          |
     | Items       | Docs by     | Recent      | Freshness   | Success  | Nodes &
     | Count       | Category    | Perceptions | of Domains  | Rate %   | Edges
     v             v             v             v             v          v
+-------------------------------------------------------------------------+
|                      RuntimeContextHealthReport                         |
|  - overallStatus: 'healthy' | 'degraded' | 'unhealthy'                  |
|  - per-subsystem metrics & status objects                               |
+-------------------------------------------------------------------------+
```

### Callers and Collaborators
- **`RuntimeContextFacade`**: Exposes `getHealthReport()` on the public context interface.
- **Desktop Diagnostics Panel**: Fetches context health reports over IPC to display memory store counts and domain staleness warnings.
- **Planner**: Inspects context health before generating multi-step plans to verify that the agent's perception and knowledge bases are reliable.

---

## Architecture

```
packages/runtime-context/src/health/
├── types.ts           # SubsystemHealthStatus, SubsystemHealthReport, RuntimeContextHealthReport
└── health-monitor.ts  # RuntimeContextHealthMonitor implementation
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `RuntimeContextHealthMonitor` | Core monitor class. Ingests references to KnowledgeStore, RuntimeIndex, ObservationEngine, ExecutionMemory, and EntityGraph. Computes metrics and assigns health states. |
| `HealthMonitorDependencies` | Dependency injection container specifying required subsystem instances. |
| `types.ts` | Type definitions for health status literals, per-subsystem reports, and composite health manifests. |

---

## Core Concepts

### 1. Subsystem Health Evaluation Rules

| Subsystem | Inspected Property | Degradation Threshold | Resulting Status |
| :--- | :--- | :--- | :--- |
| **KnowledgeStore** | Total items in store | Always reports `'healthy'` if store responds | `healthy` |
| **RuntimeIndex** | Total documents, PDFs, downloads, OCR records | Always reports `'healthy'` if indexes are searchable | `healthy` |
| **ObservationEngine** | Count of observations currently buffered | Always reports `'healthy'` | `healthy` |
| **BrowserGraph** | Ratio of stale domains (`isStale(domain)`) to total discovered domains | `staleDomains > 0 && staleDomains === domains.length` | `degraded` if all domains are stale |
| **ExecutionMemory** | Trailing 50 executions success percentage | `successRate < 50%` | `degraded` if success rate drops below 50% |
| **EntityGraph** | Active entities and relationship edge count | Always reports `'healthy'` if graph responds | `healthy` |

### 2. Composite Status Composition
The overall context status defaults to `'healthy'`. If either the BrowserGraph or ExecutionMemory reports `'degraded'`, the composite status transitions to `'degraded'`:
```typescript
let overallStatus: SubsystemHealthStatus = 'healthy'
if (bgReport.status === 'degraded' || emReport.status === 'degraded') {
  overallStatus = 'degraded'
}
```

---

## Data Flow

```
1. Caller Invocation
   contextFacade.getHealthReport()
      |
      v
2. Dependency Inspection
   - KnowledgeStore: query total items count
   - RuntimeIndex: query document counts partitioned by category (pdf, download, ocr)
   - ObservationEngine: query recent observation list length
   - BrowserGraph: list all domains, check isStale() on each domain
   - ExecutionMemory: query trailing 50 executions, compute success percentage
   - EntityGraph: query entity count and relationship count
      |
      v
3. Status Derivation
   - If 100% of discovered domains in BrowserGraph are stale -> bgStatus = 'degraded'
   - If trailing success rate < 50% -> emStatus = 'degraded'
   - If bgStatus === 'degraded' || emStatus === 'degraded' -> overallStatus = 'degraded'
      |
      v
4. Assembly & Delivery
   Return RuntimeContextHealthReport { overallStatus, timestamp, subsystems: { ... } }
```

---

## Public API

### `RuntimeContextHealthMonitor`

Located in `packages/runtime-context/src/health/health-monitor.ts`.

#### Constructor
```typescript
constructor(deps: HealthMonitorDependencies)
```

Requires instances of all five runtime context subsystems:
```typescript
export interface HealthMonitorDependencies {
  knowledgeStore: KnowledgeStore
  runtimeIndex: RuntimeIndexEngine
  observationEngine: ObservationEngine
  executionMemory: ExecutionMemoryStore
  entityGraph: RuntimeEntityGraph
}
```

#### Core Method
```typescript
getHealthReport(): RuntimeContextHealthReport
```
Synchronously compiles and returns a complete diagnostic snapshot of the runtime context.

---

### Type Definitions

Located in `packages/runtime-context/src/health/types.ts`.

```typescript
export type SubsystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface SubsystemHealthReport {
  subsystem: string
  status: SubsystemHealthStatus
  metrics: Record<string, number | string | boolean>
}

export interface RuntimeContextHealthReport {
  overallStatus: SubsystemHealthStatus
  timestamp: number
  subsystems: {
    knowledgeStore: SubsystemHealthReport
    runtimeIndex: SubsystemHealthReport
    observationEngine: SubsystemHealthReport
    browserGraph: SubsystemHealthReport
    executionMemory: SubsystemHealthReport
    entityGraph: SubsystemHealthReport
  }
}
```

---

## Internal Components

### 1. BrowserGraph Freshness Audit
The monitor iterates through all discovered domains and queries `browserGraph.isStale(d)`:
```typescript
const browserGraph = this.deps.knowledgeStore.getBrowserGraph()
const domains = browserGraph.listDomains()
let staleDomains = 0
for (const d of domains) {
  if (browserGraph.isStale(d)) staleDomains++
}
const bgStatus: SubsystemHealthStatus =
  staleDomains > 0 && staleDomains === domains.length ? 'degraded' : 'healthy'
```
If some domains are fresh, status remains `'healthy'`. Only if every single domain in the graph is stale does the subsystem flag `'degraded'`.

### 2. Execution Success Rate Window
In `ExecutionMemoryStore`:
```typescript
const recentExecs = this.deps.executionMemory.listRecent(50)
const successCount = recentExecs.filter((e) => e.success).length
const successRate =
  recentExecs.length > 0 ? Math.round((successCount / recentExecs.length) * 100) : 100
const emStatus: SubsystemHealthStatus = successRate < 50 ? 'degraded' : 'healthy'
```
This isolates transient failures while detecting prolonged systemic collapse.

---

## Lifecycle

```
[RuntimeContext Initialized]
             |
             v
[HealthMonitor Injected with Subsystems]
             |
             v
[Periodic or On-Demand getHealthReport() Polling]
             |
             +---> Read subsystem metrics
             +---> Derive status
             +---> Return RuntimeContextHealthReport
             |
[Context Disposal]
             |
             v
[Garbage Collection (No Persistent Handlers)]
```

---

## Design Tradeoffs

### 1. Knowledge-Level Health vs. Operating System Uptime
Standard software health checks only inspect whether a server process is alive (`HTTP 200 /healthz`). The Context Health Monitor evaluates whether the agent's internal mental models (routes, documents, perceptions) are fresh, valid, and reliable.
- **Tradeoff**: Detects silent cognitive degradation (e.g. an agent operating on 100% expired web routes or suffering an 80% task failure rate) even when system memory and CPU are completely healthy.
- **Cost**: Requires query hooks into six independent context subsystem stores.

### 2. Trailing 50-Execution Window vs. Lifetime Averages
Execution memory evaluates success rate across the trailing 50 task executions rather than an unbounded lifetime accumulator.
- **Tradeoff**: Isolates historical anomalies and allows the health status to recover quickly once environment issues are remediated, while bounding computation to O(50).
- **Cost**: Cannot reflect long-term historical trends spanning thousands of runs.

---

## Invariants and Guarantees

1. **Zero-Side-Effect Guarantee**: `getHealthReport()` performs only non-mutating property and length reads. It never writes to disk, acquires locks, or alters cache TTLs.
2. **Total Staleness Threshold**: The `BrowserGraph` transitions to `'degraded'` if and only if 100% of discovered domains are stale (`staleDomains === domains.length`). Partial domain staleness leaves the graph healthy.
3. **Safe Empty-Store Defaults**: If execution history is empty, the success rate defaults to `100%`. If no web domains exist, stale count is `0`. Empty stores never trigger false-positive degradations.
4. **Hierarchical Rollup**: If any monitored subsystem reports `'degraded'` or `'unhealthy'`, the top-level `overallStatus` automatically mirrors that degraded state.

---

## Failure Modes and Recovery

| Failure Scenario | Health Status | Detection Rule | Upstream Mitigation |
|---|---|---|---|
| **Web Layout Obsolescence** | `browserGraph: degraded` | 100% of domains exceed 24h TTL or confidence < 0.7 | Planner prompts proactive route re-exploration. |
| **Systemic Execution Failure** | `executionMemory: degraded` | Success rate drops below 50% across trailing 50 tasks | Halts autonomous runs; alerts user to verify credentials/network. |
| **Document Index Desync** | `runtimeIndex: 0 documents` | Monitored document counts drop unexpectedly | Triggers re-indexing pass across artifact storage. |

---

## Things To Avoid

- **Do NOT perform cache eviction or state mutations inside health monitors.** Health monitoring must be purely observational. Mutations belong in storage tiering managers.
- **Do NOT poll health at sub-second intervals in tight loops.** While `getHealthReport()` is fast (<1ms), high-frequency polling creates unnecessary CPU churn. Poll periodically (e.g. 5–30 seconds) or on demand.
- **Do NOT halt task execution simply because one domain is stale.** Partial domain staleness is normal when navigating across new and old portals. Trust the rollup threshold rules.

---

## Error Handling

Because `getHealthReport()` performs synchronous in-memory property reads on injected subsystems, it operates without throwing uncaught exceptions. If optional subsystems or collections are empty, default values (e.g. `100%` success rate for empty execution histories, `0` stale domains for empty web graphs) ensure safe evaluations.

---

## Thread Safety and Concurrency

- **Synchronous Execution**: The health evaluation runs synchronously within the Node.js event loop tick.
- **Read-Only Invariants**: No collection mutations occur during health compilation. Subsystems may continue receiving writes in subsequent event loop turns without risk of partial state reads.

---

## Performance Characteristics

| Component Evaluated | Operation | Performance Profile |
| :--- | :--- | :--- |
| `KnowledgeStore` | `getTotalCount()` | O(1) integer property read. |
| `RuntimeIndex` | `count()` queries | O(1) per category index map size check. |
| `ObservationEngine` | `query().length` | O(1) array length query. |
| `BrowserGraph` | `listDomains()` + `isStale()` | O(D) where D = unique domains (typically < 50). |
| `ExecutionMemory` | `listRecent(50)` + filter | O(N) where N <= 50 elements. |
| `EntityGraph` | `count()` | O(1) entity and relationship map size query. |

Total execution latency for `getHealthReport()` is consistently under 1 millisecond.

---

## Testing Strategy

Tests are located in `packages/runtime-context/test/health-monitor.test.ts`:

- **Healthy State Baseline**: Asserts that fresh subsystem mocks produce an `overallStatus` of `'healthy'`.
- **Domain Staleness Degradation**: Simulates a BrowserGraph where all domains exceed TTL, verifying that `browserGraph.status` and `overallStatus` transition to `'degraded'`.
- **Execution Failure Degradation**: Injects 50 execution records with >50% failure rate, confirming `executionMemory.status` becomes `'degraded'`.
- **Metric Accuracy**: Verifies that counts reported in `RuntimeContextHealthReport` accurately reflect the underlying store states.

---

## Extension Guide

### Adding a New Monitored Subsystem

1. Add the subsystem interface to `HealthMonitorDependencies` in `packages/runtime-context/src/health/health-monitor.ts`.
2. Add the subsystem's report to the `subsystems` map in `RuntimeContextHealthReport` (`packages/runtime-context/src/health/types.ts`).
3. In `getHealthReport()`, query the subsystem metrics, apply health criteria, and append the `SubsystemHealthReport` object.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Health Monitor** | `RuntimeContextFacade` | None (Stateless Query) | Diagnostics, UI, Self-Healing | Facade runtime | In-memory |
| **`RuntimeContextHealthReport`** | Caller / Facade | `getHealthReport()` | Telemetry, Diagnostics | Ephemeral snapshot | Generated on demand |
| **Trailing Execution Window** | `ExecutionMemory` | `recordExecution()` | Health Monitor | Rolling 50 executions | In-memory buffer |

---

## Failure Assumptions

1. **Non-Blocking Inquiries**: Assumes inspected context subsystems return metrics synchronously or rapidly without blocking event processing.
2. **Graceful Partial Failure**: Assumes individual subsystem metric queries can fail or throw, handling exceptions defensively to report that specific subsystem as `'degraded'` or `'unhealthy'` without crashing the report generator.
3. **Threshold Stability**: Assumes staleness rules (>24h or confidence <0.7) provide stable indicators of environment drift across sessions.

---

## Common Extension Points

- **Adding a Monitored Subsystem**: Extend `HealthMonitorDependencies` and `RuntimeContextHealthReport.subsystems` in `packages/runtime-context/src/health/types.ts`, implementing health rollup logic in `health-monitor.ts`.
- **Custom Health Alert Observers**: Subscribe to diagnostic intervals to broadcast health events over WebSockets when status transitions to `'degraded'` or `'unhealthy'`.

---

## Directory Layout

```
packages/runtime-context/src/health/
├── types.ts           # Types, statuses, and interfaces
└── health-monitor.ts  # RuntimeContextHealthMonitor implementation
```

---

## Examples

### 1. Generating a Health Report from the Context Facade
```typescript
import { RuntimeContextFacade } from '@usepilot/runtime-context'

const context = new RuntimeContextFacade()
await context.initialize()

const report = context.getHealthReport()

console.log('Overall Context Health:', report.overallStatus)
console.log('Entities in Graph:', report.subsystems.entityGraph.metrics.entitiesCount)
console.log('Indexed Documents:', report.subsystems.runtimeIndex.metrics.totalDocuments)
```

### 2. Detecting Stale Web Navigation Topologies
```typescript
const report = context.getHealthReport()

if (report.subsystems.browserGraph.status === 'degraded') {
  const { discoveredDomains, staleDomains } = report.subsystems.browserGraph.metrics
  console.warn(`BrowserGraph is degraded: ${staleDomains} of ${discoveredDomains} domains are stale.`)
  // Trigger proactive domain re-indexing
}
```

### 3. Monitoring Execution Success Rates
```typescript
const report = context.getHealthReport()

const execReport = report.subsystems.executionMemory
if (execReport.status === 'degraded') {
  console.error(`Recent execution success rate dropped to: ${execReport.metrics.successRatePercent}%`)
}
```

---

## Related Documentation

- [Runtime Context Documentation](../runtime-context/README.md) - Architectural overview of `@usepilot/runtime-context`.
- [Runtime Diagnostics Documentation](../diagnostics/README.md) - Subsystem health and resource leak tracking in the execution engine.
- [Browser Graph Documentation](../browser-graph/README.md) - Domain route topologies and staleness rules.
- [Knowledge Store Documentation](../knowledge-store/README.md) - Multi-tier persistent memory storage.
