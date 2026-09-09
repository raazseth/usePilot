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

export interface RuntimeContextState {
  sessionId: string
  version: number
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
  state: RuntimeContextState
  timestamp: number
  checksum: string
}

export interface ContextTransactionOptions {
  timeoutMs?: number | undefined
  retries?: number | undefined
}

export type StateMutationFn = (draft: RuntimeContextState) => void | Promise<void>
