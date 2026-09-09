# Runtime Context Subsystem

The **Runtime Context Subsystem** (`@usepilot/runtime-context`) provides the central state-awareness layer for usePilot.

## Core Responsibilities
- **Session State**: Manages live browser, desktop, and filesystem state.
- **Context Provenance**: Attaches source, timestamp, confidence, adapter, and correlation IDs to all context mutations.
- **Transactional Updates**: Supports atomic mutations via `context.mutate(draft => ...)` with automatic rollback on failure.
- **Immutable Snapshots**: Generates SHA-256 verified snapshots for point-in-time state inspection.

## Usage Example
```typescript
import { RuntimeContext, createProvenance } from '@usepilot/runtime-context'

const context = new RuntimeContext('session-1')
const prov = createProvenance('browser', { confidence: 0.95, adapter: 'PlaywrightBrowserAdapter' })

context.setBrowserState({
  currentUrl: 'https://github.com',
  pageTitle: 'GitHub',
  activeDomain: 'github.com',
}, prov)

const snapshot = context.createSnapshot()
console.log('Context Version:', snapshot.version, 'Checksum:', snapshot.checksum)
```
