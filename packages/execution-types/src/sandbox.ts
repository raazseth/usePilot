// Adapter Sandbox Types

import type { AdapterResult } from './adapter'

export interface SandboxOptions {
  timeoutMs?: number
  captureOutput?: boolean
  memoryLimitBytes?: number | undefined
}

export interface SandboxLogEntry {
  stream: 'stdout' | 'stderr' | 'system'
  message: string
  timestamp: number
}

export interface SandboxExecutionResult {
  adapterResult: AdapterResult
  logs: SandboxLogEntry[]
  durationMs: number
  panicked: boolean
  panicError?: string | undefined
}
