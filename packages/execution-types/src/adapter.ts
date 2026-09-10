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

export interface AdapterManifest {
  readonly name: string
  readonly version: string
  readonly apiVersion: string
  readonly runtimeVersion: string
  readonly platform: readonly ('windows' | 'macos' | 'linux')[]
  readonly permissions: readonly string[]
  readonly capabilities: readonly TaskCapability[]
  readonly featureFlags: readonly string[]
  readonly hash: string
}

export interface AdapterStartupDiagnostic {
  success: boolean
  adapterName: string
  reason?: 'success' | 'platform_mismatch' | 'missing_executable' | 'permission_denied' | 'dependency_missing' | 'initialization_error' | undefined
  error?: string | undefined
  missingDependency?: string | undefined
  missingPermission?: string | undefined
  durationMs: number
}

export interface ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority: number
  readonly platformSupport: ('windows' | 'macos' | 'linux')[]
  readonly name: string
  readonly adapterVersion?: string | undefined
  readonly minimumRuntimeVersion?: string | undefined
  readonly featureFlags?: string[] | undefined
  readonly manifest?: Readonly<AdapterManifest> | undefined
  initialize(): Promise<void>
  execute(ctx: AdapterContext): Promise<AdapterResult>
  verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
  cleanup(): Promise<void>
  dispose(): Promise<void>
  isAvailable(): Promise<boolean>
  diagnose?(): Promise<AdapterStartupDiagnostic>
}

export type AdapterFactory = (config?: Record<string, unknown>) => ICapabilityAdapter

export interface AdapterRegistration {
  factory: AdapterFactory
  capability: TaskCapability
  priority: number
  platformSupport: ('windows' | 'macos' | 'linux')[]
  name: string
}
