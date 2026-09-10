import type { ContextProvenance } from './provenance'

export interface BrowserRuntimeState {
  currentUrl?: string | undefined
  pageTitle?: string | undefined
  activeDomain?: string | undefined
  authenticatedDomains: string[]
  tabCount: number
  lastUpdated: number
}

export interface DesktopRuntimeState {
  activeWindowTitle?: string | undefined
  focusedProcessId?: number | undefined
  clipboardPreview?: string | undefined
  lastUpdated: number
}

export interface FilesystemRuntimeState {
  currentWorkingDirectory: string
  activeDownloads: string[]
  recentPaths: string[]
  lastUpdated: number
}

export const CURRENT_CONTEXT_SCHEMA_VERSION = 1

export interface RuntimeContextState {
  sessionId: string
  version: number
  contextSchemaVersion: number
  browser: BrowserRuntimeState
  desktop: DesktopRuntimeState
  filesystem: FilesystemRuntimeState
  customEntries: Record<string, { value: unknown; provenance: ContextProvenance }>
  createdAt: number
  updatedAt: number
}

export interface ContextSnapshot {
  snapshotId: string
  sessionId: string
  version: number
  contextSchemaVersion: number
  state: RuntimeContextState
  timestamp: number
  checksum: string
}

export interface ContextTransactionOptions {
  timeoutMs?: number | undefined
  retries?: number | undefined
}

export type StateMutationFn = (draft: RuntimeContextState) => void | Promise<void>

/**
 * Resource budgets and growth limits for runtime context engines.
 * Prevents memory growth and query degradation in long-running agent loops.
 */
export interface RuntimeContextBudgets {
  maxObservationsPerSession?: number | undefined
  maxEntityNodes?: number | undefined
  maxEntityEdges?: number | undefined
  maxReplaySteps?: number | undefined
  maxKnowledgeCacheEntries?: number | undefined
  maxOcrCacheEntries?: number | undefined
}
