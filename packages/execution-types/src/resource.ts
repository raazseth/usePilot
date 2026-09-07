// Resource Management Types

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
