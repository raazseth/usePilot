// Execution Context Snapshot Types

export interface RegisteredAdapterInfo {
  name: string
  capability: string
  priority: number
  version?: string
}

export interface ExecutionContextSnapshot {
  runId: string
  blueprintHash: string
  plannerVersion: string
  executionVersion: string
  platform: {
    os: string
    arch: string
    runtime: string
    nodeVersion: string
  }
  environment: Record<string, unknown>
  registeredAdapters: RegisteredAdapterInfo[]
  permissions: string[]
  createdAt: number
}
