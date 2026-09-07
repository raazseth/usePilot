# Execution Resource Manager

## Overview

The `ExecutionResourceManager` tracks and disposes transient runtime resources (adapter instances, open file descriptors, child processes, network connections, and temporary directories) allocated during plan execution.

## Key Features

1. **Centralized Registration**:
   Any component initializing an external resource registers it with the resource manager:
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
   - Iterates through all active resources in parallel.
   - Enforces an individual timeout per resource disposal (default: 5,000ms).
   - Recovers from individual disposal errors, ensuring one faulty disposal does not prevent other resources from being cleaned up.
   - Clears the registry upon completion.

3. **Lifecycle Integration**:
   - In `ExecutionRunner`, `cleanupAll()` is guaranteed to run at the conclusion of every execution (whether `completed`, `failed`, or `cancelled`).
