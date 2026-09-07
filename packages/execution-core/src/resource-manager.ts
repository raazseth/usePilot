// ExecutionResourceManager — tracks and tears down active resources

import type { IResourceManager, TrackedResource } from '@usepilot/execution-types'

export class ExecutionResourceManager implements IResourceManager {
  private readonly resources = new Map<string, TrackedResource>()

  register(resource: TrackedResource): void {
    this.resources.set(resource.id, resource)
  }

  unregister(id: string): void {
    this.resources.delete(id)
  }

  listActive(): TrackedResource[] {
    return Array.from(this.resources.values())
  }

  async cleanupAll(timeoutMs = 5000): Promise<void> {
    const list = Array.from(this.resources.values())
    this.resources.clear()

    const cleanups = list.map(async (resource) => {
      try {
        const timeoutPromise = new Promise<void>((_, reject) =>
          setTimeout(() => reject(new Error(`Cleanup timed out for ${resource.description}`)), timeoutMs)
        )
        await Promise.race([resource.dispose(), timeoutPromise])
      } catch (err) {
        // Suppress and log error to ensure remaining cleanups continue
        console.warn(`[ResourceManager] Error disposing resource "${resource.description}":`, err)
      }
    })

    await Promise.allSettled(cleanups)
  }
}
