import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect } from 'vitest'

import { ArtifactManager } from '../artifacts/artifact-manager'
import { ArtifactStore } from '../artifacts/artifact-store'

describe('ArtifactStore & ArtifactManager', () => {
  const testBaseDir = join(tmpdir(), `test-artifacts-${Date.now()}`)
  const store = new ArtifactStore(testBaseDir)
  const manager = new ArtifactManager(store)
  const executionId = 'run-art-101'

  it('initializes execution directory structure and saves text artifact with SHA-256', async () => {
    const content = 'Hello usePilot Runtime Artifact Store'
    const meta = await store.save({
      executionId,
      taskId: 'task-1',
      category: 'html',
      fileName: 'test.html',
      content,
      type: 'html',
      producer: 'browser-adapter',
      tags: ['test', 'unit'],
    })

    expect(meta.id).toContain('art-')
    expect(meta.uri).toBe(`artifact://${executionId}/html/test.html`)
    expect(meta.size).toBe(Buffer.byteLength(content))
    expect(meta.checksum.length).toBe(64) // SHA-256 hex length
    expect(meta.mimeType).toBe('text/html')
  })

  it('loads and lists stored artifacts accurately', async () => {
    const list = await store.list({ executionId })
    expect(list.length).toBeGreaterThanOrEqual(1)

    const loaded = await store.load(`artifact://${executionId}/html/test.html`)
    expect(loaded.buffer.toString('utf8')).toContain('Hello usePilot Runtime Artifact Store')
    expect(loaded.metadata.id).toBe(list[0]?.id)
  })

  it('ArtifactManager captures screenshots, DOM snapshots, and downloads', async () => {
    const screenshotBuffer = Buffer.from('mock-png-bytes')
    const screenshotMeta = await manager.captureScreenshot(
      executionId,
      'task-2',
      screenshotBuffer,
      'page-view.png'
    )
    expect(screenshotMeta.uri).toBe(`artifact://${executionId}/screenshots/page-view.png`)
    expect(screenshotMeta.type).toBe('screenshot')

    const domMeta = await manager.captureDomSnapshot(
      executionId,
      'task-2',
      '<html><body>Test DOM</body></html>',
      'page-view.html'
    )
    expect(domMeta.uri).toBe(`artifact://${executionId}/dom/page-view.html`)
    expect(domMeta.type).toBe('dom')

    const downloadBuffer = Buffer.from('invoice-pdf-mock-data')
    const downloadMeta = await manager.storeDownload(
      executionId,
      'task-3',
      'gst-invoice.pdf',
      downloadBuffer
    )
    expect(downloadMeta.uri).toBe(`artifact://${executionId}/downloads/gst-invoice.pdf`)
    expect(downloadMeta.type).toBe('download')

    const totalUsage = await manager.collectStorageUsageBytes(executionId)
    expect(totalUsage).toBeGreaterThan(0)
  })

  it('deletes artifacts and purges execution directories cleanly', async () => {
    const delRes = await store.delete(`artifact://${executionId}/html/test.html`)
    expect(delRes).toBe(true)

    const listAfter = await store.list({ executionId, category: 'html' })
    expect(listAfter.length).toBe(0)

    await manager.purgeExecutionArtifacts(executionId)
    const listFinal = await store.list({ executionId })
    expect(listFinal.length).toBe(0)
  })
})
