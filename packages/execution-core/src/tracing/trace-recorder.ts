import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { BrowserContext, Page } from 'playwright'

import { ArtifactManager } from '../artifacts/artifact-manager'
import type { ArtifactMetadata } from '../artifacts/types'

export interface TraceRecordOptions {
  screenshots?: boolean | undefined
  snapshots?: boolean | undefined
  sources?: boolean | undefined
}

export interface ConsoleLogEntry {
  type: string
  text: string
  timestamp: number
}

export interface NetworkLogEntry {
  url: string
  status: number
  method: string
  timestamp: number
}

export interface BrowserTraceSummary {
  traceArtifact?: ArtifactMetadata | undefined
  domArtifact?: ArtifactMetadata | undefined
  consoleLogs: ConsoleLogEntry[]
  networkLogs: NetworkLogEntry[]
  failedSelectors: string[]
  cookieCount: number
  hasTrace: boolean
}

export class BrowserTraceRecorder {
  private artifactManager: ArtifactManager
  private isTracing = false
  private consoleLogs: ConsoleLogEntry[] = []
  private networkLogs: NetworkLogEntry[] = []
  private failedSelectors: string[] = []
  private activeContext: BrowserContext | null = null
  private tempTraceFile: string | null = null

  constructor(customManager?: ArtifactManager) {
    this.artifactManager = customManager ?? ArtifactManager.getInstance()
  }

  async startTracing(
    context: BrowserContext,
    page?: Page,
    options: TraceRecordOptions = { screenshots: true, snapshots: true, sources: false }
  ): Promise<void> {
    this.activeContext = context
    this.consoleLogs = []
    this.networkLogs = []
    this.failedSelectors = []
    this.tempTraceFile = join(tmpdir(), `trace-${Date.now()}-${Math.random().toString(36).slice(2)}.zip`)

    if (page) {
      page.on('console', (msg) => {
        this.consoleLogs.push({
          type: msg.type(),
          text: msg.text(),
          timestamp: Date.now(),
        })
      })

      page.on('response', (res) => {
        this.networkLogs.push({
          url: res.url(),
          status: res.status(),
          method: res.request().method(),
          timestamp: Date.now(),
        })
      })
    }

    try {
      await context.tracing.start({
        screenshots: options.screenshots ?? true,
        snapshots: options.snapshots ?? true,
        sources: options.sources ?? false,
      })
      this.isTracing = true
    } catch {
      this.isTracing = false
    }
  }

  recordFailedSelector(selector: string): void {
    this.failedSelectors.push(selector)
  }

  async stopTracing(
    executionId: string,
    taskId: string,
    page?: Page
  ): Promise<BrowserTraceSummary> {
    let traceArtifact: ArtifactMetadata | undefined
    let domArtifact: ArtifactMetadata | undefined
    let cookieCount = 0

    if (this.activeContext && this.isTracing && this.tempTraceFile) {
      try {
        await this.activeContext.tracing.stop({ path: this.tempTraceFile })
        const traceBuffer = await fs.readFile(this.tempTraceFile)
        traceArtifact = await this.artifactManager.storeBrowserTrace(
          executionId,
          taskId,
          traceBuffer,
          `browser-trace-${taskId}.zip`
        )
        await fs.unlink(this.tempTraceFile).catch(() => {})
      } catch {
        // Fallback if tracing stop failed
      } finally {
        this.isTracing = false
      }
    }

    // Capture final DOM snapshot if page is accessible
    if (page && !page.isClosed()) {
      try {
        const html = await page.content()
        domArtifact = await this.artifactManager.captureDomSnapshot(
          executionId,
          taskId,
          html,
          `page-${taskId}.html`
        )
        const cookies = await page.context().cookies()
        cookieCount = cookies.length
      } catch {
        // Page was already navigating or closed
      }
    }

    return {
      traceArtifact,
      domArtifact,
      consoleLogs: [...this.consoleLogs],
      networkLogs: [...this.networkLogs],
      failedSelectors: [...this.failedSelectors],
      cookieCount,
      hasTrace: !!traceArtifact,
    }
  }
}
