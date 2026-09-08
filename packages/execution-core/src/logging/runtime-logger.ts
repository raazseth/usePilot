import type { ArtifactManager } from '../artifacts/artifact-manager'

export type RuntimeLogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'

export interface RuntimeLogEntry {
  id: string
  timestamp: number
  executionId: string
  taskId?: string | undefined
  adapter?: string | undefined
  capability?: string | undefined
  session?: string | undefined
  level: RuntimeLogLevel
  event: string
  message: string
  durationMs?: number | undefined
  data?: Record<string, unknown> | undefined
}

export interface SearchLogFilter {
  executionId?: string | undefined
  taskId?: string | undefined
  level?: RuntimeLogLevel | undefined
  event?: string | undefined
  since?: number | undefined
}

export class RuntimeLogger {
  private static instance: RuntimeLogger | null = null
  private logs: RuntimeLogEntry[] = []
  private maxLogs = 5000
  private artifactManager?: ArtifactManager | undefined

  constructor(artifactManager?: ArtifactManager) {
    this.artifactManager = artifactManager
  }

  static getInstance(): RuntimeLogger {
    if (!RuntimeLogger.instance) {
      RuntimeLogger.instance = new RuntimeLogger()
    }
    return RuntimeLogger.instance
  }

  setArtifactManager(manager: ArtifactManager): void {
    this.artifactManager = manager
  }

  log(entry: Omit<RuntimeLogEntry, 'id' | 'timestamp'>): RuntimeLogEntry {
    const fullEntry: RuntimeLogEntry = {
      ...entry,
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    }

    this.logs.push(fullEntry)
    if (this.logs.length > this.maxLogs) {
      this.logs.shift()
    }

    return fullEntry
  }

  debug(executionId: string, event: string, message: string, meta?: Partial<RuntimeLogEntry>): RuntimeLogEntry {
    return this.log({ executionId, level: 'DEBUG', event, message, ...meta })
  }

  info(executionId: string, event: string, message: string, meta?: Partial<RuntimeLogEntry>): RuntimeLogEntry {
    return this.log({ executionId, level: 'INFO', event, message, ...meta })
  }

  warn(executionId: string, event: string, message: string, meta?: Partial<RuntimeLogEntry>): RuntimeLogEntry {
    return this.log({ executionId, level: 'WARN', event, message, ...meta })
  }

  error(executionId: string, event: string, message: string, meta?: Partial<RuntimeLogEntry>): RuntimeLogEntry {
    return this.log({ executionId, level: 'ERROR', event, message, ...meta })
  }

  search(filter?: SearchLogFilter): RuntimeLogEntry[] {
    return this.logs.filter((l) => {
      if (filter?.executionId && l.executionId !== filter.executionId) return false
      if (filter?.taskId && l.taskId !== filter.taskId) return false
      if (filter?.level && l.level !== filter.level) return false
      if (filter?.event && !l.event.toLowerCase().includes(filter.event.toLowerCase())) return false
      if (filter?.since && l.timestamp < filter.since) return false
      return true
    })
  }

  async flushToArtifactStore(executionId: string): Promise<void> {
    if (!this.artifactManager) return

    const execLogs = this.search({ executionId })
    if (execLogs.length === 0) return

    const content = execLogs.map((l) => JSON.stringify(l)).join('\n')
    await this.artifactManager.getStore().save({
      executionId,
      category: 'logs',
      fileName: 'execution.log',
      content,
      type: 'execution_log',
      mimeType: 'text/plain',
      producer: 'runtime-logger',
      tags: ['logs', 'structured'],
    })
  }

  clear(): void {
    this.logs = []
  }
}
