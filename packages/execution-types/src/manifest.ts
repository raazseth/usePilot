// Execution Manifest Types

import type { ExecutionPolicy } from './policy'

export interface SelectedAdapterRecord {
  taskId: string
  capability: string
  adapterName: string
  sessionId?: string | undefined
}

export interface ExecutionManifest {
  manifestId: string
  runId: string
  traceId: string
  blueprintHash: string
  plannerVersion: string
  executionVersion: string
  policy: ExecutionPolicy
  capabilities: string[]
  selectedAdapters: SelectedAdapterRecord[]
  environment: {
    os: string
    arch: string
    runtime: string
    nodeVersion?: string | undefined
  }
  startedAt: number
  completedAt: number
  durationMs: number
  tasksSummary: {
    total: number
    completed: number
    failed: number
    skipped: number
  }
  outcome: 'success' | 'failed' | 'cancelled'
  manifestHash: string
}
