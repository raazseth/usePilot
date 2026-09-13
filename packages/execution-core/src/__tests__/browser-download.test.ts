import { createServer, type Server } from 'node:http'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import type { AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { DownloadManager } from '../adapters/browser/download-manager'
import { PlaywrightBrowserSession } from '../adapters/browser/browser-session'
import { PlaywrightBrowserAdapter } from '../adapters/browser/browser-adapter'

describe('Browser Reality Hardening — Download Manager & Collision Safety', () => {
  let server: Server
  let serverUrl: string
  let testDownloadDir: string
  let session: PlaywrightBrowserSession
  const REPORT_CONTENT = 'ANNUAL FINANCIAL AUDIT REPORT 2026 - CONFIDENTIAL - USEPILOT ENTERPRISE'

  beforeAll(async () => {
    testDownloadDir = join(tmpdir(), `usepilot_browser_download_test_${Date.now()}`)
    await fs.mkdir(testDownloadDir, { recursive: true })

    // Setup local test server serving page & downloadable file
    server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      if (url.pathname === '/download-report') {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Q3_Financial_Report.pdf"',
        })
        res.end(REPORT_CONTENT)
      } else if (url.pathname === '/empty-download') {
        res.writeHead(200, {
          'Content-Type': 'application/octet-stream',
          'Content-Disposition': 'attachment; filename="empty.txt"',
        })
        res.end('')
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head><title>Portal Reports</title></head>
          <body>
            <h1>Financial Portal</h1>
            <a id="btn-download" href="/download-report">Download Q3 Report</a>
            <a id="btn-empty" href="/empty-download">Download Corrupted File</a>
          </body>
          </html>
        `)
      }
    })

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address()
        if (typeof addr === 'object' && addr) {
          serverUrl = `http://127.0.0.1:${addr.port}`
        }
        resolve()
      })
    })

    session = new PlaywrightBrowserSession({ headless: true })
    await session.initialize()
  })

  afterAll(async () => {
    await session.dispose().catch(() => {})
    await new Promise<void>((res) => server.close(() => res()))
    await fs.rm(testDownloadDir, { recursive: true, force: true }).catch(() => {})
  })

  it('captures download, computes SHA-256, and verifies integrity', async () => {
    const page = await session.newTab(serverUrl)
    const dm = new DownloadManager()

    const result = await dm.captureDownload(page, {
      triggerAction: async () => {
        await page.click('#btn-download')
      },
      targetDirectory: testDownloadDir,
    })

    expect(result.success).toBe(true)
    expect(result.suggestedFilename).toBe('Q3_Financial_Report.pdf')
    expect(result.savedPath).toBe(join(testDownloadDir, 'Q3_Financial_Report.pdf'))
    expect(result.fileSize).toBe(Buffer.byteLength(REPORT_CONTENT))
    expect(result.sha256).toBeDefined()
    expect(result.sha256.length).toBe(64) // Valid hex SHA-256
    expect(result.verified).toBe(true)

    // Verify file content on disk matches
    const savedContent = await fs.readFile(result.savedPath, 'utf8')
    expect(savedContent).toBe(REPORT_CONTENT)

    await page.close()
  })

  it('handles name collisions gracefully with rename_with_counter', async () => {
    const page = await session.newTab(serverUrl)
    const dm = new DownloadManager()

    // Download the same file again into the same folder
    const result2 = await dm.captureDownload(page, {
      triggerAction: async () => {
        await page.click('#btn-download')
      },
      targetDirectory: testDownloadDir,
      collisionPolicy: 'rename_with_counter',
    })

    expect(result2.success).toBe(true)
    expect(result2.savedPath).toBe(join(testDownloadDir, 'Q3_Financial_Report (1).pdf'))
    expect(result2.verified).toBe(true)

    // Original file must still be intact
    const origContent = await fs.readFile(join(testDownloadDir, 'Q3_Financial_Report.pdf'), 'utf8')
    expect(origContent).toBe(REPORT_CONTENT)

    // New file must also be valid
    const newContent = await fs.readFile(result2.savedPath, 'utf8')
    expect(newContent).toBe(REPORT_CONTENT)

    await page.close()
  })

  it('rejects empty (0-byte) downloads with descriptive error', async () => {
    const page = await session.newTab(serverUrl)
    const dm = new DownloadManager()

    const emptyResult = await dm.captureDownload(page, {
      triggerAction: async () => {
        await page.click('#btn-empty')
      },
      targetDirectory: testDownloadDir,
    })

    expect(emptyResult.success).toBe(false)
    expect(emptyResult.error).toContain('0 bytes')

    await page.close()
  })

  it('integrates with PlaywrightBrowserAdapter for download_file capability', async () => {
    const adapter = new PlaywrightBrowserAdapter('download_file', { session })
    await adapter.initialize()

    // First navigate the active page to serverUrl
    const activePage = await session.getActivePage()
    await activePage.goto(serverUrl)

    const dummyBlueprint: ExecutionBlueprint = {
      id: 'bp-download-test',
      version: 1,
      hash: 'hash-download-1',
      goal: {
        id: 'g-d1',
        primaryObjective: 'Download report',
        constraints: [],
        requiredResources: [],
        expectedOutcome: 'done',
        confidence: 1,
        status: 'validated',
        normalizedInput: { text: 'download', originalText: 'download', detectedLanguage: 'en', entities: [], durationMs: 0 },
        createdAt: Date.now(),
      },
      intent: {
        type: 'browser',
        complexity: 'low',
        riskLevel: 'low',
        requiresHumanApproval: false,
        missingInformation: [],
        confidence: 1,
        durationMs: 5,
      },
      tasks: [],
      graph: { nodes: [], edges: [], parallelGroups: [], criticalPath: [], taskCount: 0, depth: 0 },
      approvals: { requiresMandatoryApproval: false, hasForbiddenTasks: false, mandatoryTaskIds: [], optionalTaskIds: [], forbiddenTaskIds: [] },
      successCriteria: [],
      estimatedComplexity: 'low',
      optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
      plannerContext: { platform: 'windows', availableTools: [], settingsSnapshot: {}, previousBlueprintCount: 0 },
      createdAt: Date.now(),
    }

    const downloadTask: Task = {
      id: 'task-download-1',
      title: 'Download Financial Report',
      description: 'Click download button and capture file',
      category: 'extraction',
      requiredCapability: 'download_file',
      toolConfig: {
        triggerSelector: '#btn-download',
        targetDirectory: testDownloadDir,
        customFilename: 'Final_Q3_Report.pdf',
      },
      preconditions: [],
      postconditions: [],
      successConditions: ['File downloaded and verified'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: downloadTask,
      blueprint: dummyBlueprint,
      runId: 'r-dl-1',
      traceId: 'tr-dl-1',
      signal: new AbortController().signal,
    }

    const res = await adapter.execute(ctx)
    expect(res.success).toBe(true)
    const output = res.output as { savedPath: string; sha256: string; verified: boolean }
    expect(output.savedPath).toBe(join(testDownloadDir, 'Final_Q3_Report.pdf'))
    expect(output.verified).toBe(true)

    const verification = await adapter.verify(ctx, res)
    expect(verification.passed).toBe(true)
    expect(verification.checkedConditions[0]).toContain('Downloaded file verified')
  })
})
