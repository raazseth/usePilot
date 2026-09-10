# Observation Subsystem

Observation Engine (`@usepilot/runtime-context/src/observations`) ingests structured environmental perceptions across browser, filesystem, desktop, vision, and verification layers, isolating environmental reality from temporal lifecycle events and synchronizing runtime context state.

---

## Purpose

Automated agents need to understand the state of the system they are operating upon. Many automation architectures conflate **Events** with **Observations**:
- An **Event** is a temporal lifecycle occurrence: `"TaskStarted"`, `"TaskCompleted"`, `"ApprovalRequested"`.
- An **Observation** is a structured, factual snapshot of physical environment state at a given moment: `"Current URL is https://example.com/login"`, `"File on disk is 4,120 bytes with checksum 8f1b..."`, `"Active desktop window is Notepad (PID 1420)"`.

Conflating the two produces bloated event streams and prevents deterministic state reconstruction.

The Observation Subsystem owns:
- Canonical observation types (`browser_state`, `filesystem_state`, `desktop_state`, `vision_state`, `verification_state`).
- Bounded in-memory perception buffer management (`maxStoredObservations = 2000`).
- Automated synchronization of active environment state into `RuntimeContext`.
- Publisher-subscriber notification dispatch for real-time diagnostics and UI observers.
- Query filtering by type, provenance source, correlation ID, confidence threshold, and time windows.
- Feed source for the Observation Replay Engine.

The Observation Subsystem intentionally does NOT own:
- Execution scheduling, workflow retries, or task status journals (owned by the Execution Runner).
- Physical browser socket communication or OS command execution (owned by capability adapters).
- Vector indexing or semantic search (owned by the Runtime Index Engine).

---

## Design Principles

### 1. Separation of Events from Observations
Events represent actions taken by the agent system. Observations represent the external reality perceived by the agent before or after actions occur. This decoupling ensures that:
- Planners evaluate plans against verified observations, not self-reported task successes.
- Debuggers can view the state of the browser or filesystem independent of whether a task passed or failed.
- Forensic replays can step forward and backward through environment states without re-executing actions.

### 2. Synchronous Context Reflection
When an observation is emitted into the engine with a target `RuntimeContext`, the engine automatically reflects the new perception into the active context:
- A `BrowserObservation` updates `context.setBrowserState()`.
- A `DesktopObservation` updates `context.setDesktopState()`.
- A `FilesystemObservation` updates `context.setFilesystemState()`.
- Vision and verification observations update custom context state entries.

### 3. Bounded Memory Ring Buffer
Observations are high-frequency records. In long-running sessions, unbounded retention would exhaust memory. The `ObservationEngine` maintains a bounded buffer (default 2,000 entries). When new observations exceed the threshold, the oldest records are dropped (`this.observations.shift()`), guaranteeing strict memory limits.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Separation of observations from lifecycle events** | Unified event bus with generic JSON payload | Lifecycle events report intent and progress (`task_started`), whereas observations report ground-truth environmental state (`browser_state`). Conflating them pollutes state reconciliation and prevents deterministic forensic replay. |
| **Bounded ring buffer (2,000 entries)** | Unbounded append-only array | Automation sessions executing thousands of steps generate tens of thousands of intermediate perceptions; unbounded arrays lead to process OOM crashes. 2,000 entries cover the full context of any active task run. |
| **Synchronous context reflection** | Async batch worker | Planners and self-healing algorithms rely on instantaneous knowledge of the newly observed state immediately after an action completes; asynchronous batching would introduce race conditions. |
| **Typed observation payloads** | Generic arbitrary dictionary | Strong typing guarantees compile-time verification across adapters and prevents schema drift between browser, filesystem, desktop, vision, and verification telemetry. |

---

## Invariants and Guarantees

1. **Strict Immutability**: Emitted observation objects are frozen upon intake and never modified in-place by subscribers or replay engines.
2. **Deterministic Context Sync**: When an observation is emitted with a valid target context, the corresponding context state (`browserState`, `desktopState`, `filesystemState`) is updated synchronously before `emit()` returns.
3. **Chronological Ordering**: Observations within the buffer are strictly ordered by their `timestamp` of ingestion.
4. **Subscriber Isolation**: An exception thrown by an individual observer callback is caught and logged, preventing subscriber failures from halting observation emission or task execution.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Subscriber callback throws error** | Try-catch block wrapping listener invocation | Catches error, logs diagnostic warning, continues dispatch to remaining subscribers. | Does not remove or unsubscribe the failing listener automatically. |
| **Context synchronization failure** | Target context method throws | Catches exception, retains observation in ring buffer, logs error. | Does not halt the capability adapter that emitted the observation. |
| **Ring buffer capacity exceeded** | `observations.length > maxStoredObservations` | Drops the oldest observation via FIFO queue shift (`shift()`). | Does not persist dropped observations to disk automatically (delegated to diagnostics). |
| **Invalid/Missing observation fields** | Schema/type checking on emission | Rejects or logs malformed record. | Does not fabricate missing environmental values. |

---

## Things To Avoid

- **Do NOT emit workflow lifecycle events into the Observation Engine**: Use the Diagnostics timeline for `task_started` or `step_completed`; reserve the Observation Engine for physical environment states.
- **Do NOT mutate observation objects**: Treat all queried observations as read-only snapshots.
- **Do NOT bypass `ObservationEngine` when updating `RuntimeContext`**: Emitting observations ensures that subscribers, replay engines, and timeline forecasters remain synchronized.
- **Do NOT perform heavy blocking operations in observer listeners**: Subscriber callbacks run synchronously on the emission path; offload heavy computations to microtasks.

---

---

## Where It Fits

The Observation Subsystem resides in `packages/runtime-context/src/observations/` and acts as the perception bridge between execution adapters and the runtime context.

```
+------------------------------------------------------------------------+
|                          Capability Adapters                           |
|      (BrowserAdapter, FilesystemAdapter, DesktopAdapter, Vision)       |
+------------------------------------------------------------------------+
                                     |
                                     | 1. Emits concrete state perceptions
                                     v
+------------------------------------------------------------------------+
|                          ObservationEngine                             |
+------------------------------------------------------------------------+
   |                                 |                                |
   | 2. Synchronize                  | 3. Buffer bounded              | 4. Notify
   v                                 v (2,000 entries)                v
+------------------+     +-----------------------+     +------------------+
|  RuntimeContext  |     |     Observations      |     | Pub/Sub          |
|  - browserState  |     |      Ring Buffer      |     | Subscribers      |
|  - desktopState  |     +-----------------------+     | (UI / Diagnostics|
|  - fsState       |                 |                 +------------------+
+------------------+                 v
                         +-----------------------+
                         | ObservationReplay     |
                         | Engine                |
                         +-----------------------+
```

### Callers and Collaborators
- **`PlaywrightBrowserAdapter`**: Emits `BrowserObservation` records containing URLs, DOM fingerprints, and interactive element trees.
- **`NativeFilesystemAdapter`**: Emits `FilesystemObservation` records with target paths, sizes, and SHA-256 digests.
- **`NativeDesktopAdapter`**: Emits `DesktopObservation` records with active window titles, process IDs, and clipboard contents.
- **`VisionSubsystem`**: Emits `VisionObservation` records with detected text bounding boxes and image hashes.
- **`ObservationReplayEngine`**: Ingests observations to power step-by-step forensic scrubbing.

---

## Architecture

```
packages/runtime-context/src/observations/
├── types.ts                # Observation schemas, payloads, and filter interfaces
└── observation-engine.ts   # ObservationEngine implementation, pub/sub, and query API
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `ObservationEngine` | Core perception engine. Buffers observations, synchronizes with `RuntimeContext`, broadcasts to subscribers, and handles queries. |
| `BrowserObservation` | Snapshot of active web page URL, title, domain, DOM fingerprint, and interactive element descriptors. |
| `FilesystemObservation` | Snapshot of file path existence, byte size, MIME type, permissions, and SHA-256 hash. |
| `DesktopObservation` | Snapshot of active window title, focused PID/process name, and clipboard text hash. |
| `VisionObservation` | Snapshot of image hash, screen dimensions, and recognized text geometries. |
| `VerificationObservation` | Record of verified target assertions, expected vs. observed values, and strategy names. |

---

## Core Concepts

### 1. The Observation Envelope (`BaseObservation`)

All observation variants inherit common envelope properties:

```typescript
export interface BaseObservation {
  id: string                          // e.g. "obs-browser-1725760000"
  type: ObservationType               // 'browser_state' | 'filesystem_state' ...
  timestamp: number                   // Unix epoch timestamp in milliseconds
  source: ProvenanceSource            // Component that generated the perception
  confidence: number                  // Reliability score (0.0 to 1.0)
  provenance: ContextProvenance       // Complete provenance record
  correlationId?: string              // Linked executionId or taskId
  metadata?: Record<string, unknown>  // Additional custom attributes
}
```

### 2. Observation Payload Types

#### `BrowserObservation`
```typescript
export interface BrowserObservation extends BaseObservation {
  type: 'browser_state'
  payload: {
    currentUrl: string
    pageTitle: string
    domain: string
    domFingerprint: string
    interactiveElements: InteractiveElementDescriptor[]
    viewport: { width: number; height: number }
  }
}
```

#### `FilesystemObservation`
```typescript
export interface FilesystemObservation extends BaseObservation {
  type: 'filesystem_state'
  payload: {
    targetPath: string
    exists: boolean
    sizeBytes: number
    mimeType?: string
    sha256Checksum?: string
    isWritable: boolean
    isDirectory: boolean
  }
}
```

#### `DesktopObservation`
```typescript
export interface DesktopObservation extends BaseObservation {
  type: 'desktop_state'
  payload: {
    activeWindowTitle?: string
    focusedProcessId?: number
    focusedProcessName?: string
    clipboardHash?: string
    clipboardPreview?: string
  }
}
```

#### `VisionObservation`
```typescript
export interface VisionObservation extends BaseObservation {
  type: 'vision_state'
  payload: {
    imageHash: string
    detectedTexts: VisionTextElement[] // { text, confidence, bbox: [x,y,w,h] }
    width: number
    height: number
  }
}
```

#### `VerificationObservation`
```typescript
export interface VerificationObservation extends BaseObservation {
  type: 'verification_state'
  payload: {
    target: string
    assertionDescription: string
    observedValue: unknown
    expectedValue?: unknown
    satisfied: boolean
    strategyName: string
  }
}
```

---

## Data Flow

```
1. Adapter Action Concludes
   BrowserAdapter navigates to new URL
      |
      v
2. Construct Observation
   obs = {
     id: 'obs-101',
     type: 'browser_state',
     timestamp: Date.now(),
     source: 'browser',
     confidence: 1.0,
     provenance: createProvenance('browser-adapter'),
     payload: { currentUrl: 'https://acme.com', ... }
   }
      |
      v
3. Emit to ObservationEngine
   engine.emit(obs, targetRuntimeContext)
      |
      +---> 4a. Ring Buffer Ingestion
      |         - push to observations[]
      |         - if length > 2000 -> shift() oldest
      |
      +---> 4b. Context Synchronization
      |         - context.setBrowserState({ currentUrl, pageTitle, activeDomain })
      |
      +---> 4c. Subscriber Notification
                - invoke all registered subscriber callbacks
```

---

## Public API

### `ObservationEngine`

Located in `packages/runtime-context/src/observations/observation-engine.ts`.

#### Singleton & Constructor
```typescript
static getInstance(): ObservationEngine
constructor(maxStoredObservations = 2000)
```

#### Ingestion Method
```typescript
// Emit new observation, push to buffer, synchronize context, and notify subscribers
emit(observation: Observation, targetContext?: RuntimeContext): void
```

#### Query & Retrieval Methods
```typescript
// Query observations matching filter criteria, sorted chronologically
query(filter?: ObservationFilter): Observation[]

// Get most recent observation, optionally filtered by type
getLatest(type?: ObservationType): Observation | undefined
```

#### Pub/Sub Subscription
```typescript
// Register callback for real-time observation updates; returns unsubscribe function
subscribe(subscriber: ObservationSubscriber): () => void
```

#### Maintenance Methods
```typescript
// Remove observations matching custom predicate
purge(predicate: (obs: Observation) => boolean): number

// Clear entire observation buffer
clear(): void
```

---

### Filter Options (`ObservationFilter`)

```typescript
export interface ObservationFilter {
  type?: ObservationType | undefined
  source?: ProvenanceSource | undefined
  correlationId?: string | undefined
  fromTimestamp?: number | undefined
  toTimestamp?: number | undefined
  minConfidence?: number | undefined
  limit?: number | undefined
}
```

---

## Internal Components

### 1. `synchronizeWithContext(observation, context)`
Evaluates `observation.type` and maps domain-specific payloads into appropriate `RuntimeContext` methods:
- `'browser_state'` -> `context.setBrowserState()`
- `'desktop_state'` -> `context.setDesktopState()`
- `'filesystem_state'` -> `context.setFilesystemState()`
- `'vision_state'` / `'verification_state'` -> `context.setCustomEntry('obs:<id>', payload)`

### 2. Subscriber Error Isolation
In `emit()`, subscriber callbacks are wrapped in individual `try / catch` blocks:
```typescript
for (const subscriber of this.subscribers) {
  try {
    subscriber(observation)
  } catch (err) {
    console.error('[ObservationEngine] Subscriber error:', err)
  }
}
```
A faulty UI listener or logging subscriber will never interrupt core observation buffering or context synchronization.

---

## Lifecycle

```
[ObservationEngine Initialized]
              |
              v
[Continuous emit() from Adapters]
  - Buffered up to maxStoredObservations
  - Automatically synced to RuntimeContext
  - Dispatched to real-time subscribers
              |
              v
[Context Inspection & Forensics]
  - query({ type: 'browser_state', limit: 10 })
  - getLatest('desktop_state')
              |
              v
[Post-Execution Cleanup / Replay]
  - ObservationReplayEngine loads buffer for step-by-step scrubbing
  - purge() or clear() resets buffer
```

---

## Error Handling

The observation engine operates entirely in-memory and does not throw operational exceptions during `emit()`, `query()`, or `getLatest()`. Invalid queries return empty arrays.

---

## Thread Safety and Concurrency

- **Deterministic Array Modification**: All array operations (`push`, `shift`, `filter`) occur synchronously in the JavaScript event loop.
- **Immutable Query Output**: `query()` returns a shallow copy of matched observations, preventing external callers from mutating the internal buffer.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `emit()` | O(1) buffer push + O(S) subscribers | Sub-microsecond (excluding context sync time). |
| `getLatest(type)` | O(N) reverse scan (typically < 10 steps) | Sub-microsecond. |
| `query(filter)` | O(N log N) filter + sort | ~1 ms for 2,000 observations. |
| `purge()` | O(N) array filter | ~1 ms. |

---

## Testing Strategy

Tests reside in `packages/runtime-context/test/observation-engine.test.ts`:

- **Ring Buffer Capping**: Emits 2,500 observations into an engine configured for 2,000, confirming the buffer size remains exactly 2,000 and the first 500 were dropped.
- **Context Synchronization**: Confirms that emitting a `BrowserObservation` updates `RuntimeContext.getState().browser` with matching URLs and page titles.
- **Filter Precision**: Validates filtering across observation types, minimum confidence thresholds, and timestamp ranges.
- **Subscriber Unsubscription**: Verifies that calling the function returned by `subscribe()` halts further callback invocations.

---

## Extension Guide

### Adding a New Observation Type

1. In `packages/runtime-context/src/observations/types.ts`, add the type literal to `ObservationType`:
   ```typescript
   export type ObservationType =
     | 'browser_state'
     | 'filesystem_state'
     | 'desktop_state'
     | 'vision_state'
     | 'verification_state'
     | 'database_state' // new type
   ```
2. Define the typed interface:
   ```typescript
   export interface DatabaseObservation extends BaseObservation {
     type: 'database_state'
     payload: {
       connected: boolean
       activeConnections: number
       transactionCount: number
     }
   }
   ```
3. Update `Observation` union and add synchronization handling in `ObservationEngine.synchronizeWithContext()`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Observations Ring Buffer** | `ObservationEngine` | Capability Adapters | Replay, Diagnostics, UI | Rolling 2,000 items | Volatile memory |
| **Observation Subscribers** | `ObservationEngine` | `subscribe()` callbacks | UI, Observers | Component mount lifetime | Cleared via unsubscribe closure |
| **Context State Projection** | `RuntimeContextFacade` | `emit()` sync trigger | Planner, Execution Engine | Active session | Exported with context snapshots |

---

## Failure Assumptions

1. **Memory Cap Invariant**: Assumes continuous high-volume perception streams, enforcing a fixed 2,000-entry ceiling where oldest observations are dropped via `shift()` to prevent memory exhaustion.
2. **Subscriber Isolation**: Assumes subscriber listener callbacks may fail, executing listener calls inside try-catch blocks to guarantee notification errors never abort observation intake.
3. **Synchronous Reflection**: Assumes context mutations triggered by observations execute synchronously without blocking event loop turns.

---

## Common Extension Points

- **Adding a New Observation Type**: Extend `ObservationType` union and define a typed interface extending `BaseObservation` in `packages/runtime-context/src/types.ts`.
- **Registering Specialized Context Sync**: Update `ObservationEngine.emit()` to map newly defined observation types to corresponding context state properties.

---

## Directory Layout

```
packages/runtime-context/src/observations/
├── types.ts                # Observation schemas and filter types
└── observation-engine.ts   # Core ObservationEngine implementation
```

---

## Examples

### 1. Emitting a Browser Observation with Context Sync
```typescript
import { ObservationEngine } from '@usepilot/runtime-context'
import { createProvenance } from '@usepilot/runtime-context'

const engine = ObservationEngine.getInstance()

engine.emit(
  {
    id: `obs-${Date.now()}`,
    type: 'browser_state',
    timestamp: Date.now(),
    source: 'browser',
    confidence: 1.0,
    provenance: createProvenance('browser-adapter'),
    payload: {
      currentUrl: 'https://app.slack.com/client',
      pageTitle: 'Slack | General Channel',
      domain: 'app.slack.com',
      domFingerprint: '4f9e1b2c',
      interactiveElements: [
        { selector: 'button#send-msg', tag: 'button', text: 'Send', isClickable: true }
      ],
      viewport: { width: 1440, height: 900 },
    },
  },
  runtimeContext // Automatically synchronizes context browser state
)
```

### 2. Querying Recent Verification Failures
```typescript
const failedVerifications = engine.query({
  type: 'verification_state',
  limit: 5,
}).filter((obs) => obs.payload.satisfied === false)

for (const fail of failedVerifications) {
  console.log('Verification Assertion Failed:', fail.payload.assertionDescription)
}
```

### 3. Subscribing to Live Environment Perceptions
```typescript
const unsubscribe = engine.subscribe((observation) => {
  if (observation.type === 'desktop_state') {
    console.log('Active Desktop Window:', observation.payload.activeWindowTitle)
  }
})

// Unsubscribe when UI panel closes
unsubscribe()
```

---

## Related Documentation

- [Runtime Context Documentation](../runtime-context/README.md) - Context engine state management.
- [Observation Replay Subsystem](../replay/README.md) - Step-by-step forensic state reproduction.
- [Capability Verification Documentation](../verification/README.md) - Generation of verification observations.
- [Browser Subsystem Documentation](../browser/README.md) - Browser state observation production.
