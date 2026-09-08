import { promises as fs } from 'node:fs'
import { join } from 'node:path'

import type { JournalEntry, ExecutionReport, ExecutionPolicy } from '@usepilot/execution-types'

import type { ArtifactManager } from '../artifacts/artifact-manager'
import type { ArtifactMetadata } from '../artifacts/types'

export interface FailureBundleManifest {
  bundleVersion: string
  executionId: string
  failedAt: number
  failureReason: string
  failedTaskId?: string | undefined
  report?: ExecutionReport | undefined
  policySnapshot?: ExecutionPolicy | undefined
  journalEntries: JournalEntry[]
  artifacts: ArtifactMetadata[]
  verificationFailures: Array<{ taskId?: string | undefined; error: string; timestamp: number }>
}

export class FailureBundleGenerator {
  private artifactManager: ArtifactManager

  constructor(artifactManager: ArtifactManager) {
    this.artifactManager = artifactManager
  }

  async generateBundle(options: {
    executionId: string
    failureReason: string
    failedTaskId?: string | undefined
    report?: ExecutionReport | undefined
    policySnapshot?: ExecutionPolicy | undefined
    journalEntries: JournalEntry[]
    verificationFailures?: Array<{ taskId?: string | undefined; error: string; timestamp: number }> | undefined
  }): Promise<{ bundleDir: string; manifestPath: string; manifest: FailureBundleManifest }> {
    const store = this.artifactManager.getStore()
    const execDir = await store.initializeExecutionDir(options.executionId)
    const bundleDir = join(execDir, 'failure-bundle')
    await fs.mkdir(bundleDir, { recursive: true })

    const artifacts = await this.artifactManager.getExecutionArtifacts(options.executionId)

    const manifest: FailureBundleManifest = {
      bundleVersion: '1.0.0',
      executionId: options.executionId,
      failedAt: Date.now(),
      failureReason: options.failureReason,
      failedTaskId: options.failedTaskId,
      report: options.report,
      policySnapshot: options.policySnapshot,
      journalEntries: options.journalEntries,
      artifacts,
      verificationFailures: options.verificationFailures ?? [],
    }

    const manifestPath = join(bundleDir, 'failure-manifest.json')
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf8')

    // Also register the manifest itself as an artifact in reports category
    await store.save({
      executionId: options.executionId,
      taskId: options.failedTaskId,
      category: 'reports',
      fileName: 'failure-bundle-manifest.json',
      content: JSON.stringify(manifest, null, 2),
      type: 'json',
      mimeType: 'application/json',
      producer: 'failure-bundle-generator',
      tags: ['diagnostic', 'failure-bundle', 'manifest'],
    })

    return {
      bundleDir,
      manifestPath,
      manifest,
    }
  }
}
