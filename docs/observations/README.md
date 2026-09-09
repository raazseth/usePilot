# Observation Subsystem

The **Observation Subsystem** implements state perception across browser, filesystem, desktop, vision, and verification layers.

## Key Principles
1. **Strict Separation from Events**:
   - Events are temporal occurrences (`TaskStarted`, `ExecutionCompleted`).
   - Observations are state descriptions (`currentUrl`, `interactiveElements`, `sizeBytes`, `clipboardPreview`).
2. **Canonical Typed Language**:
   - `BrowserObservation`
   - `FilesystemObservation`
   - `DesktopObservation`
   - `VisionObservation`
   - `VerificationObservation`
3. **Context Synchronization**:
   - The `ObservationEngine` automatically updates `RuntimeContext` when observations are emitted.

## Usage Example
```typescript
import { ObservationEngine, createProvenance } from '@usepilot/runtime-context'

const engine = ObservationEngine.getInstance()
engine.emit({
  id: 'obs-001',
  type: 'browser_state',
  timestamp: Date.now(),
  source: 'browser',
  confidence: 1.0,
  provenance: createProvenance('browser'),
  payload: {
    currentUrl: 'https://amazon.in',
    pageTitle: 'Amazon',
    domain: 'amazon.in',
    domFingerprint: 'sha-fp',
    interactiveElements: [],
    viewport: { width: 1920, height: 1080 }
  }
})
```
