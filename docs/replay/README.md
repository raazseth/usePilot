# Execution and Observation Replay Subsystem

Replay Subsystems provide non-destructive, read-only forensic reconstruction of past automation workflows across Execution Replay (`@usepilot/execution-core`) and Observation Replay (`@usepilot/runtime-context`), projecting cumulative environment states and carry-forward artifact pointers across stepped interactive timelines.

---

## Purpose

Automated agents perform dozens of state transitions per minute across web portals, operating system windows, and the local filesystem. When a workflow fails or behaves unexpectedly:
- Live re-execution is dangerous: forms may be submitted twice, bank transfers or orders may be repeated, and API quotas are wasted.
- Raw log files fail to convey visual and environmental context: reading that a selector failed does not show what was displayed on screen at that moment.
- Static screenshot folders lack temporal alignment: inspecting a folder of images does not indicate which task or verification check was active when each image was taken.

The Replay Subsystem owns:
- Deterministic post-mortem reconstruction without live action dispatch or network calls.
- Stepped interactive playback controls (`stepForward()`, `stepBackward()`, `seekTo()`).
- Cumulative state projection: carrying forward the most recent screenshot URI, DOM snapshot, active window, and file state at each step.
- Assembly of self-contained `ReplayFrame` structures linking chronological timeline events to artifact metadata.
- Verification assertion inspection at arbitrary historical playback offsets.

The Replay Subsystem intentionally does NOT own:
- Action execution or capability dispatch (replay is strictly 100% read-only).
- Physical artifact storage on disk (delegated to the Runtime Artifact Store).
- Journal database persistence (delegated to the execution journal).

---

## Design Principles

### 1. Zero Live Execution Invariant
The Replay Subsystem is strictly read-only. It consumes historical journal entries, artifact manifests, and observation records. Under no circumstances does seeking, stepping forward, or stepping backward invoke Playwright browser actions, shell commands, or filesystem mutations.

### 2. State Projection and Carry-Forward
In real-world automation, not every step generates a screenshot or modifies a file. If a workflow captures a screenshot on Step 2 and fails on Step 7, a user inspecting Step 7 still needs to see the screenshot captured on Step 2. Both replay engines implement **carry-forward semantics**:
- In `ExecutionReplayEngine`: `screenshotUri` and `domSnapshotUri` persist forward across subsequent frames until a newer snapshot replaces them.
- In `ObservationReplayEngine`: `latestBrowser`, `latestFilesystem`, `latestDesktop`, and `latestVision` states accumulate from Step 0 up to `currentStep`.

### 3. Dual-Layer Replay Architecture
- **Execution Replay** (`ExecutionReplayEngine`): Focuses on the **Agent's Actions**: tasks started, retries attempted, self-healing interventions, approval gates, and generated artifacts.
- **Observation Replay** (`ObservationReplayEngine`): Focuses on the **Environment's Reality**: URL routes, active PIDs, file sizes, clipboard text hashes, and OCR bounding boxes.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Carry-forward references (`artifact://`) over duplicate byte storage** | Store full DOM and screenshot binary blobs per frame | Re-saving 2MB screenshots on every micro-step exhausts gigabytes of storage within minutes. Storing canonical artifact URIs with carry-forward references allows instant reconstruction with minimal memory overhead. |
| **Purely read-only projection** | Simulated sandbox re-execution | Re-executing actions against mocks or sandboxes inevitably drifts from what actually occurred and risks accidental side effects (e.g. repeated payments, external API mutations). |
| **Stepped projection over continuous video playback** | MP4 video encoding per run | Video encoding requires high CPU overhead, prevents programmatic DOM element inspection, and cannot correlate specific verification assertions with individual timeline frames. |
| **Decoupled execution and observation replay engines** | Single unified replay class | Keeps execution lifecycle telemetry (`@usepilot/execution-core`) cleanly separated from environmental perception state (`@usepilot/runtime-context`). |

---

## Invariants and Guarantees

1. **Strictly Read-Only**: Seeking, stepping forward, or stepping backward will never trigger browser automation, network traffic, or filesystem modifications.
2. **Safe Clamping**: Seeking to an index outside `[0, totalSteps - 1]` is clamped safely to the closest boundary (`0` or `totalSteps - 1`) and never throws an out-of-bounds exception.
3. **Carry-Forward Continuity**: If a frame does not generate a new screenshot or DOM snapshot, the engine preserves the pointer to the most recently generated artifact from prior frames.
4. **Idempotent Playback**: Seeking to step `N` multiple times produces the exact same projected state every time.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Empty journal / No observations** | Input list length === 0 | Returns a valid empty frame structure with totalSteps = 0. | Does not fabricate synthetic frames. |
| **Referenced artifact missing on disk** | UI attempts to render missing `artifact://` URI | Replay frame retains URI string; UI layer renders placeholder error card. | Does not fail replay stepping or halt timeline navigation. |
| **Corrupted timestamp sequence** | Journal entries out of chronological order | Sorts input events chronologically by timestamp during engine initialization. | Does not reject un-ordered journal arrays. |
| **Seek index out of bounds** | `index < 0` or `index >= totalSteps` | Automatically clamps index: `Math.max(0, Math.min(totalSteps - 1, index))`. | Does not throw `IndexOutOfBoundsError`. |

---

## Things To Avoid

- **Do NOT execute live actions during replay**: Never connect capability adapters or dispatch action commands inside replay routines.
- **Do NOT duplicate binary image payloads per frame**: Always use canonical `artifact://` URIs and carry-forward pointers.
- **Do NOT mutate returned `ReplayFrame` objects**: Treat frame state as immutable to avoid corrupting subsequent stepping operations.
- **Do NOT assume every frame has a fresh screenshot**: Always handle the possibility that `screenshotUri` points to a snapshot taken several steps earlier.

---

---

## Where It Fits

The Replay Subsystem spans `packages/execution-core/src/replay/` and `packages/runtime-context/src/replay/`, feeding directly into the desktop UI's History and Diagnostics views.

```
+-------------------------------------------------------------------------+
|                              Execution Run                              |
+-------------------------------------------------------------------------+
       |                                                    |
       | Journal Entries & Artifacts                        | Observations Stream
       v                                                    v
+-----------------------------+               +--------------------------+
|    ExecutionReplayEngine    |               |  ObservationReplayEngine |
|   (@usepilot/execution-core)|               |(@usepilot/runtime-context|
+-----------------------------+               +--------------------------+
       |                                                    |
       | Timeline Frames                                    | Stepped Cumulative State
       | with carry-forward media                           | (Seek / Step / Rewind)
       v                                                    v
+-------------------------------------------------------------------------+
|                        Desktop Application UI                           |
|                       (History & Debug Player)                          |
|  - Scrub timeline bar [ 0 =======|====== N ]                            |
|  - Visual viewport: current screenshot & DOM snapshot                   |
|  - Active task card, failure notes, and verification assertions         |
+-------------------------------------------------------------------------+
```

### Callers and Collaborators
- **Desktop UI (`apps/desktop/`)**: Binds scrubber bars and playback buttons to `seekTo()`, `stepForward()`, and `stepBackward()`.
- **`DiagnosticTimelineBuilder`**: Synthesizes journal events and artifact metadata into the base timeline used by `ExecutionReplayEngine`.
- **`ObservationEngine`**: Provides recorded observation arrays to `ObservationReplayEngine`.
- **`ArtifactStore`**: Resolves virtual `artifact://` URIs referenced in replay frames to physical files when the UI displays screenshots.

---

## Architecture

```
packages/execution-core/src/replay/
  `-- replay-engine.ts       # ExecutionReplayEngine and ReplayFrame interfaces
packages/runtime-context/src/replay/
  `-- observation-replay.ts  # ObservationReplayEngine and ReplayStateSnapshot
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `ExecutionReplayEngine` | Rebuilds execution task timelines. Chains journal entries with artifacts, propagates latest screenshots/DOMs, and outputs `ReplayFrame[]`. |
| `ObservationReplayEngine` | State machine providing interactive stepped navigation (`seekTo`, `stepForward`, `stepBackward`). Computes point-in-time environment snapshots (`ReplayStateSnapshot`). |
| `ReplayFrame` | Immutable frame data representing an execution event, active task, associated artifacts, and active visual URIs. |
| `ReplayStateSnapshot` | Cumulative environment state at a given step index (browser URL, DOM fingerprint, filesystem path, desktop window, OCR counts). |

---

## Core Concepts

### 1. Execution Replay Frame (`ReplayFrame`)

```typescript
export interface ReplayFrame {
  stepIndex: number                      // Zero-indexed frame number
  event: TimelineEvent                   // Underlying timeline event
  screenshotUri?: string                 // Latest active screenshot URI
  domSnapshotUri?: string                // Latest active DOM HTML URI
  associatedArtifacts: ArtifactMetadata[] // Artifacts created in this task/event
  activeTaskTitle?: string               // Formatted task identifier, e.g. "Task t-1"
}
```

### 2. Observation Replay Snapshot (`ReplayStateSnapshot`)

```typescript
export interface ReplayStateSnapshot {
  stepIndex: number
  totalSteps: number
  currentObservation?: Observation
  browser?: {
    currentUrl: string
    pageTitle: string
    domFingerprint: string
  }
  filesystem?: {
    lastPath: string
    exists: boolean
    sizeBytes: number
  }
  desktop?: {
    activeWindowTitle?: string
    focusedProcessId?: number
  }
  vision?: {
    imageHash: string
    detectedTextCount: number
  }
  verification?: {
    target: string
    satisfied: boolean
  }
}
```

### 3. Carry-Forward Projection Logic
In `ExecutionReplayEngine`:
```typescript
private buildFrames(): void {
  let latestScreenshotUri: string | undefined
  let latestDomUri: string | undefined

  this.frames = this.timeline.map((event, index) => {
    if (event.type === 'screenshot' && event.artifactUri) {
      latestScreenshotUri = event.artifactUri
    }
    if (event.artifactUri?.includes('/dom/') || event.artifactUri?.endsWith('.html')) {
      latestDomUri = event.artifactUri
    }

    const associated = this.artifacts.filter(
      (a) => (event.taskId && a.taskId === event.taskId) || a.uri === event.artifactUri
    )

    return {
      stepIndex: index,
      event,
      screenshotUri: latestScreenshotUri,
      domSnapshotUri: latestDomUri,
      associatedArtifacts: associated,
      activeTaskTitle: event.taskId ? `Task ${event.taskId}` : undefined,
    }
  })
}
```
If a screenshot is taken at Step 3, Steps 4, 5, 6, and 7 carry forward that screenshot URI until Step 8 captures a newer image.

---

## Data Flow

```
1. Ingest Historical Data
   - ExecutionReplayEngine: journalEntries[] + artifacts[]
   - ObservationReplayEngine: observations[]
      |
      v
2. Chronological Normalization
   - Sort all events strictly by timestamp: a.timestamp - b.timestamp
      |
      v
3. Frame Synthesis (Execution Replay)
   - Iterate through timeline events
   - Carry forward latest screenshot & DOM snapshot URIs
   - Group artifacts associated with each task
   - Produce ReplayFrame[]
      |
      v
4. Interactive Seeking (Observation Replay)
   - User UI scrubs to Step 14: seekTo(14)
   - Loop from step 0 to 14
   - Update latestBrowser, latestFilesystem, latestDesktop, latestVision
   - Produce ReplayStateSnapshot for step 14
      |
      v
5. Display in Desktop Forensic Player
   - UI renders current task status from ReplayFrame
   - UI displays current screenshot and cumulative environment values
```

---

## Public API

### `ExecutionReplayEngine`

Located in `packages/execution-core/src/replay/replay-engine.ts`.

#### Constructor & Factory
```typescript
constructor(
  executionId: string,
  journalEntries: JournalEntry[],
  artifacts: ArtifactMetadata[],
  report?: ExecutionReport
)

// Factory loading artifacts automatically from ArtifactManager
static async fromArtifactManager(
  executionId: string,
  artifactManager: ArtifactManager,
  journalEntries: JournalEntry[],
  report?: ExecutionReport
): Promise<ExecutionReplayEngine>
```

#### Inspection Methods
```typescript
// Total frames in the execution timeline
getTotalSteps(): number

// Retrieve specific frame by index
getFrame(stepIndex: number): ReplayFrame | undefined

// Retrieve all generated frames
getAllFrames(): ReplayFrame[]

// Retrieve underlying raw sorted timeline events
getTimeline(): TimelineEvent[]

// Retrieve associated execution report
getReport(): ExecutionReport | undefined

// Get execution run identifier
getExecutionId(): string
```

---

### `ObservationReplayEngine`

Located in `packages/runtime-context/src/replay/observation-replay.ts`.

#### Constructor & Loading
```typescript
constructor(observations?: Observation[])
loadObservations(observations: Observation[]): void
```

#### Playback Navigation Methods
```typescript
// Jump directly to a step index; clamps between 0 and totalSteps - 1
seekTo(stepIndex: number): ReplayStateSnapshot | undefined

// Advance playback by one step
stepForward(): ReplayStateSnapshot | undefined

// Rewind playback by one step
stepBackward(): ReplayStateSnapshot | undefined

// Get cumulative snapshot at current step index
getCurrentSnapshot(): ReplayStateSnapshot

// Current step cursor
getCurrentStep(): number

// Total observations in replay buffer
getTotalSteps(): number

// Filter observations by specific type
filterByType(type: ObservationType): Observation[]
```

---

## Internal Components

### 1. Cumulative Projection Loop
In `ObservationReplayEngine.getCurrentSnapshot()`:
```typescript
for (let i = 0; i <= this.currentStep; i++) {
  const obs = this.observations[i]
  if (!obs) continue

  if (obs.type === 'browser_state') {
    latestBrowser = {
      currentUrl: obs.payload.currentUrl,
      pageTitle: obs.payload.pageTitle,
      domFingerprint: obs.payload.domFingerprint,
    }
  } else if (obs.type === 'filesystem_state') {
    latestFilesystem = {
      lastPath: obs.payload.targetPath,
      exists: obs.payload.exists,
      sizeBytes: obs.payload.sizeBytes,
    }
  }
  // ... desktop, vision, verification
}
```
This loop ensures that the perceived state at any historical moment accurately reflects all observations that occurred prior to that step.

---

## Lifecycle

```
[Workflow Execution Concludes (or Fails)]
                   |
                   v
[Journal Entries & Artifacts Persisted]
                   |
                   v
[ExecutionReplayEngine Instantiated]
  - Timeline built
  - Frames generated with carry-forward media
                   |
                   v
[User Opens Desktop Replay Viewer]
  - UI binds to ReplayFrame[]
  - User scrubs timeline: seekTo(index)
  - UI updates viewports without live execution
                   |
                   v
[Forensic Audit Concluded]
```

---

## Error Handling

Replay operations are completely non-destructive and defensive. Seeking to out-of-bounds step indices automatically clamps the index between `0` and `totalSteps - 1`. Empty observation buffers return `undefined` on seek without throwing errors.

---

## Thread Safety and Concurrency

- **Immutable Data Structures**: `ReplayFrame` and `ReplayStateSnapshot` records are pure data structures.
- **Multiple Concurrent Viewers**: Because replay engines hold no shared mutable state and perform no file writes, multiple UI sessions can inspect the same execution simultaneously without locking.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `new ExecutionReplayEngine(...)` | O(N log N) where N = events + artifacts | ~1 - 3 ms for 500 events. |
| `getFrame(stepIndex)` | O(1) | Sub-microsecond array lookup. |
| `seekTo(stepIndex)` (Observation) | O(K) where K = target step index | ~10 - 50 microseconds for 1,000 steps. |
| `stepForward()` / `stepBackward()` | O(K) state fold | ~10 - 50 microseconds. |

---

## Testing Strategy

Tests are located in `packages/execution-core/src/__tests__/timeline-replay.test.ts` and `packages/runtime-context/src/__tests__/replay-expiration.test.ts`:

- **Chronological Monotonicity**: Asserts that `DiagnosticTimelineBuilder` and `ExecutionReplayEngine` order all events such that `timestamp[i] >= timestamp[i-1]`.
- **Screenshot Carry-Forward**: Confirms that frames occurring after a screenshot event inherit the screenshot's URI until overwritten.
- **Stepped Playback Bounds**: Validates that seeking below 0 or beyond `totalSteps` clamps correctly without index exceptions.
- **Cumulative Projection**: Simulates browser navigation followed by a filesystem write, confirming `getCurrentSnapshot()` reflects both the active browser URL and the latest file path.

---

## Extension Guide

### Adding New State Dimensions to Replay

1. Add the state field to `ReplayStateSnapshot` in `packages/runtime-context/src/replay/observation-replay.ts`:
   ```typescript
   export interface ReplayStateSnapshot {
     // ... existing fields
     database?: {
       lastQuery: string
       rowsAffected: number
     } | undefined
   }
   ```
2. In `getCurrentSnapshot()`, add a handler for the new observation type to update `latestDatabase`.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Replay Frames Array** | `ExecutionReplayEngine` | Constructor builder | UI Timeline View | Post-mortem inspection | In-memory reconstruction |
| **Projected Observation State** | `ObservationReplayEngine` | `seekTo()`, `stepForward()` | UI Inspector | Scrubbing session | Reconstructed from recorded observations |
| **Historical Artifacts** | `ArtifactStore` | Read-only access | Replay Renderers | Independent retention | On local disk under `artifact://` |

---

## Failure Assumptions

1. **Strict Read-Only Invariant**: Assumes replay operations never dispatch active tool commands, network packets, or filesystem mutations.
2. **Missing Artifact Tolerance**: Assumes historical artifact files referenced by URIs might have been pruned from disk, displaying placeholder cards rather than aborting playback.
3. **Index Boundary Clamping**: Assumes interactive users may request out-of-bounds frame indexes, automatically clamping queries safely to `[0, totalSteps - 1]`.

---

## Common Extension Points

- **Adding an Observed Domain to Replay**: Extend `ReplayStateSnapshot` in `packages/runtime-context/src/replay/observation-replay.ts` (e.g. tracking native process tree state) and update state projection logic in `getCurrentSnapshot()`.
- **Custom Replay Exporters**: Add serialization methods on `ExecutionReplayEngine` to export static HTML/JSON playback bundles for external audits.

---

## Directory Layout

```
packages/execution-core/src/replay/
  `-- replay-engine.ts       # ExecutionReplayEngine, ReplayFrame, factory methods
packages/runtime-context/src/replay/
  `-- observation-replay.ts  # ObservationReplayEngine, ReplayStateSnapshot, playback
```

---

## Examples

### 1. Initializing Execution Replay from ArtifactManager
```typescript
import { ArtifactManager, ExecutionReplayEngine } from '@usepilot/execution-core'

const artifactManager = ArtifactManager.getInstance()
const executionId = 'run-checkout-99'

// Reconstruct replay from journal and stored disk artifacts
const replay = await ExecutionReplayEngine.fromArtifactManager(
  executionId,
  artifactManager,
  journalEntries,
  finalReport
)

console.log('Total Replay Steps:', replay.getTotalSteps())

const failedFrame = replay.getAllFrames().find((f) => f.event.status === 'failed')
if (failedFrame) {
  console.log(`Failed at step ${failedFrame.stepIndex} (${failedFrame.activeTaskTitle})`)
  console.log('Active Screenshot at Failure:', failedFrame.screenshotUri)
  console.log('Active DOM Snapshot at Failure:', failedFrame.domSnapshotUri)
}
```

### 2. Interactive Step-by-Step Observation Scrubbing
```typescript
import { ObservationReplayEngine } from '@usepilot/runtime-context'

const replayEngine = new ObservationReplayEngine(recordedObservations)

// Seek to midpoint
const snapshot = replayEngine.seekTo(15)

console.log(`Current Step: ${snapshot?.stepIndex} of ${snapshot?.totalSteps}`)
console.log('Browser URL at step 15:', snapshot?.browser?.currentUrl)
console.log('Active Window at step 15:', snapshot?.desktop?.activeWindowTitle)

// Step forward
const nextSnapshot = replayEngine.stepForward()
console.log('Advanced to:', nextSnapshot?.stepIndex)
```

---

## Related Documentation

- [Diagnostics Subsystem Documentation](../diagnostics/README.md) - Diagnostic timeline construction and event schemas.
- [Observation Subsystem Documentation](../observations/README.md) - Observation production and context synchronization.
- [Runtime Artifact Subsystem](../artifacts/README.md) - Virtual artifact URIs and asset persistence.
