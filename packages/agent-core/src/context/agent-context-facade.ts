export interface HotContext {
  activeUrl?: string | undefined
  activeTabTitle?: string | undefined
  currentFolder?: string | undefined
  desktopFocusedApp?: string | undefined
}

export interface WarmContext {
  relevantEntities: string[]
  knownDomains: string[]
  retrievedKnowledge: string[]
}

export interface ColdContext {
  recentSuccessfulWorkflows: string[]
  recentFailedWorkflows: string[]
  userPreferences: Record<string, unknown>
}

export interface RetrievedAgentContext {
  hot: HotContext
  warm: WarmContext
  cold: ColdContext
}

export interface AgentMemoryRecord {
  id: string
  workflowId: string
  status: 'completed' | 'failed'
  tasksExecuted: number
  durationMs: number
  error?: string | undefined
  timestamp: number
}

export interface AgentContextFacadeOptions {
  initialHotContext?: HotContext | undefined
  initialPreferences?: Record<string, unknown> | undefined
}

/**
 * AgentContextFacade — Unified contextual view spanning Hot, Warm, and Cold tiers.
 *
 * Consumes existing @usepilot/runtime-context patterns without creating a redundant memory platform.
 */
export class AgentContextFacade {
  private hotContext: HotContext
  private readonly preferences: Record<string, unknown>
  private readonly executionHistory: AgentMemoryRecord[] = []

  constructor(options: AgentContextFacadeOptions = {}) {
    this.hotContext = options.initialHotContext ? { ...options.initialHotContext } : {}
    this.preferences = options.initialPreferences ? { ...options.initialPreferences } : {}
  }

  setHotContext(hot: Partial<HotContext>): void {
    this.hotContext = { ...this.hotContext, ...hot }
  }

  setPreference(key: string, value: unknown): void {
    this.preferences[key] = value
  }

  getPreference<T = unknown>(key: string): T | undefined {
    return this.preferences[key] as T | undefined
  }

  recordExecution(record: Omit<AgentMemoryRecord, 'id' | 'timestamp'>): void {
    const fullRecord: AgentMemoryRecord = {
      ...record,
      id: `mem-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }
    this.executionHistory.unshift(fullRecord)
    if (this.executionHistory.length > 50) {
      this.executionHistory.pop()
    }
  }

  retrieveContext(goalText: string): RetrievedAgentContext {
    const lower = goalText.toLowerCase()

    // 1. Hot Context
    const hot: HotContext = { ...this.hotContext }

    // 2. Warm Context from knowledge/entities
    const relevantEntities: string[] = []
    const knownDomains: string[] = []
    const retrievedKnowledge: string[] = []

    if (hot.activeUrl) {
      try {
        const domain = new URL(hot.activeUrl).hostname
        knownDomains.push(domain)
      } catch {
        // invalid URL string, ignore
      }
    }

    // 3. Cold Context (Memory & Preferences)
    const recentSuccessfulWorkflows: string[] = []
    const recentFailedWorkflows: string[] = []

    for (const rec of this.executionHistory) {
      if (rec.workflowId) {
        if (rec.status === 'completed' && !recentSuccessfulWorkflows.includes(rec.workflowId)) {
          recentSuccessfulWorkflows.push(rec.workflowId)
        } else if (rec.status === 'failed' && !recentFailedWorkflows.includes(rec.workflowId)) {
          recentFailedWorkflows.push(rec.workflowId)
        }
      }
    }

    // Extract relevant preferences matching goal keywords
    const userPreferences: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(this.preferences)) {
      if (lower.includes(k.toLowerCase()) || k === 'defaultDownloadFolder' || k === 'defaultReportsFolder') {
        userPreferences[k] = v
      }
    }

    return {
      hot,
      warm: {
        relevantEntities,
        knownDomains,
        retrievedKnowledge,
      },
      cold: {
        recentSuccessfulWorkflows,
        recentFailedWorkflows,
        userPreferences,
      },
    }
  }
}
