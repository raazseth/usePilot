// Adapter Types

import type { Task, ExecutionBlueprint, TaskCapability } from '@usepilot/planner-types'
import type { FailureCategory } from './execution'
import type { VerificationResult } from './verification'

export interface AdapterContext {
  task: Task
  blueprint: ExecutionBlueprint
  runId: string
  traceId: string
  signal: AbortSignal
}

export interface AdapterResult {
  success: boolean
  output?: unknown | undefined
  error?: string | undefined
  failureCategory?: FailureCategory | undefined
  durationMs: number
}

export interface ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority: number
  readonly platformSupport: ('windows' | 'macos' | 'linux')[]
  readonly name: string
  initialize(): Promise<void>
  execute(ctx: AdapterContext): Promise<AdapterResult>
  verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
  cleanup(): Promise<void>
  dispose(): Promise<void>
  isAvailable(): Promise<boolean>
}

export type AdapterFactory = (config?: Record<string, unknown>) => ICapabilityAdapter

export interface AdapterRegistration {
  factory: AdapterFactory
  capability: TaskCapability
  priority: number
  platformSupport: ('windows' | 'macos' | 'linux')[]
  name: string
}
