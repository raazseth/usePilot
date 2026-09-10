# Execution Resource Manager

## Overview

The `ExecutionResourceManager` tracks and disposes transient runtime resources (adapter instances, open file descriptors, child processes, network connections, and temporary directories) allocated during plan execution.

## Data Structures

```typescript
export type TrackedResourceType = 'adapter' | 'temp_file' | 'handle' | 'session'

export interface TrackedResource {
  id: string
  type: TrackedResourceType
  description: string
  dispose: () => Promise<void>
  registeredAt: number
}

export interface IResourceManager {
  register(resource: TrackedResource): void
  unregister(id: string): void
  cleanupAll(): Promise<void>
  listActive(): TrackedResource[]
}
```

## Key Responsibilities

1. **Centralized Registration**:
   Components initializing external or stateful resources register them with the resource manager:
   ```typescript
   resourceManager.register({
     id: `adapter-${task.id}`,
     type: 'adapter',
     description: `${adapter.name} for ${task.requiredCapability}`,
     dispose: () => adapter.dispose(),
     registeredAt: Date.now(),
   })
   ```

2. **Timeout-Safe Teardown (`cleanupAll`)**:
   - Disposes all registered resources concurrently.
   - Enforces an individual timeout per resource disposal (default: 5,000ms).
   - Recovers from individual disposal errors, ensuring one faulty cleanup does not abort the remaining disposals.
   - Clears active tracked resources upon completion.

3. **Lifecycle Integration**:
   - In `ExecutionRunner`, `cleanupAll()` is guaranteed to execute in a `finally` block at the conclusion of every execution run, whether `completed`, `failed`, or `cancelled`.

