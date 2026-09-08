import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import { ArtifactStore } from './artifact-store'
import type { ArtifactMetadata } from './types'

export class ArtifactManager {
  private static instance: ArtifactManager | null = null
  private store: ArtifactStore

  constructor(customStore?: ArtifactStore) {
    this.store = customStore ?? new ArtifactStore()
  }

  static getInstance(): ArtifactManager {
    if (!ArtifactManager.instance) {
      ArtifactManager.instance = new ArtifactManager()
    }
    return ArtifactManager.instance
  }

  getStore(): ArtifactStore {
    return this.store
  }

  async captureScreenshot(
    executionId: string,
    taskId: string,
    screenshotBuffer: Buffer,
    fileName = `screenshot-${Date.now()}.png`
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      taskId,
      category: 'screenshots',
      fileName,
      content: screenshotBuffer,
      type: 'screenshot',
      mimeType: 'image/png',
      producer: 'browser-adapter',
      tags: ['viewport', 'verification'],
    })
  }

  async captureDomSnapshot(
    executionId: string,
    taskId: string,
    htmlContent: string,
    fileName = `dom-${Date.now()}.html`
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      taskId,
      category: 'dom',
      fileName,
      content: htmlContent,
      type: 'dom',
      mimeType: 'text/html',
      producer: 'browser-adapter',
      tags: ['dom', 'snapshot'],
    })
  }

  async storeDownload(
    executionId: string,
    taskId: string,
    fileName: string,
    content: Buffer
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      taskId,
      category: 'downloads',
      fileName,
      content,
      type: 'download',
      producer: 'browser-adapter',
      tags: ['user-download', 'file'],
    })
  }

  async storeOcrResult(
    executionId: string,
    taskId: string,
    ocrJson: Record<string, unknown>,
    fileName = `ocr-${Date.now()}.json`
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      taskId,
      category: 'ocr',
      fileName,
      content: JSON.stringify(ocrJson, null, 2),
      type: 'ocr',
      mimeType: 'application/json',
      producer: 'vision-subsystem',
      tags: ['ocr', 'text-recognition'],
    })
  }

  async storeBrowserTrace(
    executionId: string,
    taskId: string,
    traceBuffer: Buffer,
    fileName = `trace-${Date.now()}.zip`
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      taskId,
      category: 'browser',
      fileName,
      content: traceBuffer,
      type: 'trace',
      mimeType: 'application/zip',
      producer: 'browser-trace-recorder',
      tags: ['playwright', 'trace', 'diagnostic'],
    })
  }

  async storeExecutionReport(
    executionId: string,
    reportJson: Record<string, unknown>,
    fileName = 'execution-report.json'
  ): Promise<ArtifactMetadata> {
    return this.store.save({
      executionId,
      category: 'reports',
      fileName,
      content: JSON.stringify(reportJson, null, 2),
      type: 'json',
      mimeType: 'application/json',
      producer: 'execution-runner',
      tags: ['report', 'manifest'],
    })
  }

  async getExecutionArtifacts(executionId: string): Promise<ArtifactMetadata[]> {
    return this.store.list({ executionId })
  }

  async collectStorageUsageBytes(executionId?: string): Promise<number> {
    const list = await this.store.list(executionId ? { executionId } : undefined)
    return list.reduce((total, a) => total + a.size, 0)
  }

  async purgeExecutionArtifacts(executionId: string): Promise<void> {
    const list = await this.store.list({ executionId })
    for (const art of list) {
      await this.store.delete(art.id)
    }
    const execDir = join(this.store.getBaseDir(), executionId)
    try {
      await fs.rm(execDir, { recursive: true, force: true })
    } catch {
      // Best effort removal
    }
  }
}
