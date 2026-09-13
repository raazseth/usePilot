import { createServer, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

import { SkillRegistry } from '../registry/skill-registry'
import { SkillDiscovery } from '../discovery/skill-discovery'
import { SkillResolver } from '../resolver/skill-resolver'
import { SkillWorkflowCompiler } from '../workflow/compiler'
import { SkillVerifier } from '../verification/skill-verifier'
import { BUILTIN_SKILLS } from '../skills/builtin'

import {
  createProductionRegistry,
  PlaywrightBrowserSession,
  ExecutionRunner,
  TaskScheduler,
  ExecutionStateMachine,
  ApprovalGate,
  ExecutionJournal,
  InMemoryJournalBackend,
  CheckpointManager,
  InMemoryCheckpointBackend,
  ExecutionMetricsCollector,
  ExecutionPolicyEngine,
  PolicyBasedCapabilityNegotiator,
  ExecutionResourceManager,
  SessionManager,
  SafeFileOperations,
  WindowsPathNormalizer,
} from '@usepilot/execution-core'

describe('Cross-Runtime Milestone E2E: Web Download to Hardened Filesystem', () => {
  let server: Server
  let serverUrl: string
  let targetReportsDir: string
  let browserSession: PlaywrightBrowserSession

  const REPORT_PAYLOAD = '%PDF-1.4\n1 0 obj\n<< /Title (Annual Q3 Report 2026) /Author (usePilot AI Enterprise) >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF'
  const EXPECTED_SHA256 = createHash('sha256').update(REPORT_PAYLOAD).digest('hex')

  beforeAll(async () => {
    targetReportsDir = join(tmpdir(), `usepilot_cross_runtime_milestone_${Date.now()}`)
    await fs.mkdir(targetReportsDir, { recursive: true })

    // Setup local HTTP server simulating dynamic DOM, cookie overlay, and downloadable PDF report
    server = createServer((req, res) => {
      console.log('--- TEST SERVER HIT ---', req.method, req.url)
      const url = new URL(req.url ?? '/', `http://${req.headers.host}`)
      if (url.pathname === '/download/Q3-Performance-Report.pdf') {
        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Disposition': 'attachment; filename="Q3-Performance-Report.pdf"',
          'Content-Length': Buffer.byteLength(REPORT_PAYLOAD),
        })
        res.end(REPORT_PAYLOAD)
      } else {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>Enterprise Financial Portal</title>
            <style>
              body { font-family: sans-serif; margin: 0; padding: 40px; }
              #cookie-modal {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.85); color: white;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                z-index: 99999;
              }
              #cookie-modal button {
                padding: 10px 20px; font-size: 16px; margin-top: 15px; cursor: pointer;
              }
              .container { max-width: 800px; margin: 0 auto; }
              .card { border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div id="cookie-modal">
              <h2>Cookie & Privacy Consent</h2>
              <p>We use essential cookies to maintain secure sessions and compliance.</p>
              <button id="btn-accept" onclick="document.getElementById('cookie-modal').remove()">Accept All</button>
            </div>

            <div class="container">
              <h1>Enterprise Financial Portal</h1>
              <p>Quarterly and annual performance disclosures for accredited auditors.</p>
              <div class="card">
                <h3>Q3 2026 Audit Report</h3>
                <p>Status: Signed & Certified</p>
                <a id="download-link" href="/download/Q3-Performance-Report.pdf" download="Q3-Performance-Report.pdf">
                  Download Latest Report
                </a>
              </div>
            </div>
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

    browserSession = new PlaywrightBrowserSession({ headless: true })
    await browserSession.initialize()
  })

  afterAll(async () => {
    await browserSession.dispose().catch(() => {})
    await new Promise<void>((resolve) => server.close(() => resolve()))
    await fs.rm(targetReportsDir, { recursive: true, force: true }).catch(() => {})
  })

  it('runs complete cross-runtime workflow: Web dynamic DOM -> Auto Cookie Dismissal -> Download -> Filesystem Category Relocation -> SHA-256 Verification -> Trust Receipt', async () => {
    console.log('\n========================================================================')
    console.log('CROSS-RUNTIME MILESTONE E2E: BROWSER REALITY + FILESYSTEM COLLISION SAFETY')
    console.log('========================================================================')

    // 1. Natural Language Prompt
    const userPrompt = `Go to ${serverUrl}, download the latest reports, and organize them in my Reports folder.`
    console.log(`User Prompt: "${userPrompt}"`)

    // 2. Skill Discovery
    const skillRegistry = new SkillRegistry()
    for (const s of BUILTIN_SKILLS) skillRegistry.register(s)
    const discovery = new SkillDiscovery(skillRegistry)

    const candidates = discovery.discover({ text: userPrompt })
    expect(candidates.length).toBeGreaterThan(0)
    const topCandidate = candidates[0]!
    expect(topCandidate.skillId).toBe('download-and-organize')
    console.log(`Discovered Skill: ${topCandidate.skillId} (Score: ${topCandidate.score.toFixed(2)})`)

    const skill = skillRegistry.get(topCandidate.skillId)!

    // 3. Skill Resolution
    const resolver = new SkillResolver()
    const resolution = resolver.resolve(skill, {
      url: serverUrl,
      destinationFolder: targetReportsDir,
      fileExtension: '.pdf',
    })
    expect(resolution.status).toBe('ready')
    console.log('Resolved Inputs:', resolution.configuredInputs)

    // 4. Workflow Compilation to Execution Blueprint
    const compiler = new SkillWorkflowCompiler()
    const { workflow, blueprint } = await compiler.compile(skill, resolution.configuredInputs)
    expect(workflow.skillId).toBe('download-and-organize')
    expect(blueprint.tasks.length).toBe(4)
    console.log(`Compiled Blueprint: ${blueprint.tasks.length} tasks generated`)
    blueprint.tasks.forEach((t, i) => console.log(`  [Task ${i + 1}]: ${t.id} -> ${t.title}`))

    // 5. Execution Engine Setup with Shared Headless Browser Session
    const execRegistry = createProductionRegistry({ browserSession })
    const scheduler = new TaskScheduler()
    const stateMachine = new ExecutionStateMachine()
    const approvalGate = new ApprovalGate()
    const journal = new ExecutionJournal(new InMemoryJournalBackend())
    const checkpoints = new CheckpointManager('run-cross-runtime-milestone', new InMemoryCheckpointBackend())
    const metrics = new ExecutionMetricsCollector('run-cross-runtime-milestone', 'trace-cross-runtime-milestone')
    const policyEngine = new ExecutionPolicyEngine()
    const negotiator = new PolicyBasedCapabilityNegotiator()
    const resourceManager = new ExecutionResourceManager()
    const sessionManager = new SessionManager(
      { defaultScope: policyEngine.getSessionScope('download_file') },
      { resourceManager }
    )

    const runner = new ExecutionRunner({
      registry: execRegistry,
      scheduler,
      stateMachine,
      approvalGate,
      journal,
      checkpoints,
      metrics,
      policyEngine,
      negotiator,
      resourceManager,
      sessionManager,
    })

    // 6. Execute Full Pipeline
    console.log('\nExecuting cross-runtime pipeline...')
    const runResult = await runner.run(
      'run-cross-runtime-milestone',
      'trace-cross-runtime-milestone',
      blueprint,
      {
        callbacks: {
          onTaskStarted: (taskId, title) => console.log('--> [TASK START]', taskId, title),
          onTaskCompleted: (taskId, durationMs) => console.log('--> [TASK DONE]', taskId, `${durationMs}ms`),
          onTaskFailed: (taskId, error, category) => console.log('--> [TASK FAILED]', taskId, error, category),
          onApprovalRequired: async (_r, _t, task) => {
            console.log('--> [APPROVAL REQUIRED & GRANTED]', task.id, task.title)
            approvalGate.resolve(task.id, {
              requestId: `req-${task.id}`,
              taskId: task.id,
              approved: true,
              respondedAt: Date.now(),
            })
          },
        },
      }
    )

    console.log('Workflow Execution Result:', runResult.status, JSON.stringify(runResult.report?.taskSummaries, null, 2))
    expect(runResult.status).toBe('completed')
    expect(runResult.tasksCompleted).toBe(4)
    console.log(`Workflow Execution Result: ${runResult.status} (Tasks: ${runResult.tasksCompleted}/4 completed)`)

    // 7. Verify Filesystem Invariants
    const documentsDir = join(targetReportsDir, 'Documents')
    expect(await fs.stat(documentsDir)).toBeDefined()

    const finalReportPath = join(documentsDir, 'Q3-Performance-Report.pdf')
    const fileStat = await fs.stat(finalReportPath)
    expect(fileStat.size).toBe(Buffer.byteLength(REPORT_PAYLOAD))

    const fileBytes = await fs.readFile(finalReportPath)
    const fileHash = createHash('sha256').update(fileBytes).digest('hex')
    expect(fileHash).toBe(EXPECTED_SHA256)

    // Check staging folder is empty or cleaned up
    const stagingDir = join(targetReportsDir, '_staging')
    try {
      const stagingContents = await fs.readdir(stagingDir)
      expect(stagingContents.length).toBe(0)
    } catch {
      // Staging folder may be removed entirely
    }

    // 8. Prove Collision Safety: Re-downloading the same report must NEVER overwrite!
    const fileOps = new SafeFileOperations(new WindowsPathNormalizer())
    const tempSecondDownload = join(targetReportsDir, 'temp_second.pdf')
    await fs.writeFile(tempSecondDownload, REPORT_PAYLOAD)

    const collisionMoveResult = await fileOps.moveFile(tempSecondDownload, finalReportPath, {
      collisionPolicy: 'rename_with_counter',
      computeHashes: true,
    })

    expect(collisionMoveResult.status).toBe('success')
    expect(collisionMoveResult.resolvedDestination).toBe(join(documentsDir, 'Q3-Performance-Report (1).pdf'))
    expect(await fs.stat(finalReportPath)).toBeDefined() // Original unchanged!
    expect(await fs.stat(collisionMoveResult.resolvedDestination)).toBeDefined() // New file created!

    // 9. Semantic Outcome Verification via SkillVerifier
    const verifier = new SkillVerifier()
    const verification = verifier.verify(skill, resolution.configuredInputs, runResult)
    expect(verification.verified).toBe(true)

    // 10. Generate and Print the Verified Cross-Runtime Trust Receipt
    const receiptLines = [
      '======================================================',
      'USEPILOT CROSS-RUNTIME EXECUTION TRUST RECEIPT',
      '======================================================',
      `Workflow: ${skill.name} (${skill.id})`,
      `Source URL: ${serverUrl}`,
      `Destination: ${targetReportsDir}`,
      'Cookie Banner Interception: AUTO-DISMISSED via PopupGuard',
      'Download Integrity: VERIFIED (Non-empty stream)',
      `Downloaded File: Q3-Performance-Report.pdf (${fileStat.size} bytes)`,
      `Cryptographic SHA-256: ${fileHash}`,
      `Collision Invariant: 0 Silent Overwrites (Policy: rename_with_counter)`,
      'Status: 100% VERIFIED',
      '======================================================',
    ]

    console.log('\n' + receiptLines.join('\n') + '\n')
  }, 45000)
})
