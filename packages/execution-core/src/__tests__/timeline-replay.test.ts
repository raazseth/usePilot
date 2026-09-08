import type { JournalEntry } from '@usepilot/execution-types'
import { describe, it, expect } from 'vitest'

import type { ArtifactMetadata } from '../artifacts/types'
import { DiagnosticTimelineBuilder } from '../diagnostics/diagnostic-timeline'
import { ExecutionReplayEngine } from '../replay/replay-engine'

describe('Diagnostic Timeline & Execution Replay (Deliverables 4 & 5)', () => {
  const executionId = 'run-replay-999'

  const mockJournalEntries: JournalEntry[] = [
    {
      id: 'j-1',
      runId: executionId,
      traceId: 'tr-1',
      eventType: 'execution_started',
      payload: { blueprintId: 'bp-1' },
      timestamp: 1000,
    },
    {
      id: 'j-2',
      runId: executionId,
      traceId: 'tr-1',
      taskId: 't-1',
      eventType: 'task_started',
      payload: { capability: 'navigate_website' },
      timestamp: 1200,
    },
    {
      id: 'j-3',
      runId: executionId,
      traceId: 'tr-1',
      taskId: 't-1',
      eventType: 'task_retrying',
      payload: { stage: 'semantic', selector: '#login-btn' },
      timestamp: 1400,
    },
    {
      id: 'j-4',
      runId: executionId,
      traceId: 'tr-1',
      taskId: 't-1',
      eventType: 'verification_result',
      payload: { passed: true, strategy: 'BrowserStateVerifier' },
      timestamp: 1600,
    },
    {
      id: 'j-5',
      runId: executionId,
      traceId: 'tr-1',
      taskId: 't-1',
      eventType: 'task_completed',
      payload: { durationMs: 600 },
      timestamp: 1800,
    },
    {
      id: 'j-6',
      runId: executionId,
      traceId: 'tr-1',
      eventType: 'execution_completed',
      payload: { status: 'completed' },
      timestamp: 2000,
    },
  ]

  const mockArtifacts: ArtifactMetadata[] = [
    {
      id: 'art-1',
      uri: `artifact://${executionId}/screenshots/login-page.png`,
      executionId,
      taskId: 't-1',
      capability: 'navigate_website',
      type: 'screenshot',
      mimeType: 'image/png',
      checksum: 'sha-screenshot-1',
      size: 154200,
      createdAt: 1300,
      producer: 'browser-adapter',
      tags: ['viewport'],
      path: '/mock/path/login-page.png',
    },
    {
      id: 'art-2',
      uri: `artifact://${executionId}/dom/login-page.html`,
      executionId,
      taskId: 't-1',
      capability: 'navigate_website',
      type: 'dom',
      mimeType: 'text/html',
      checksum: 'sha-dom-1',
      size: 45000,
      createdAt: 1350,
      producer: 'browser-adapter',
      tags: ['dom'],
      path: '/mock/path/login-page.html',
    },
  ]

  it('DiagnosticTimelineBuilder merges journal entries and artifacts into chronological order', () => {
    const builder = new DiagnosticTimelineBuilder()
    const timeline = builder.fromJournalAndArtifacts(executionId, mockJournalEntries, mockArtifacts)

    expect(timeline.length).toBe(8) // 6 journal events + 2 artifact events
    expect(timeline[0]?.type).toBe('execution_start')
    expect(timeline[timeline.length - 1]?.type).toBe('execution_complete')

    // Confirm strict monotonic chronological order
    for (let i = 1; i < timeline.length; i++) {
      expect(timeline[i]!.timestamp).toBeGreaterThanOrEqual(timeline[i - 1]!.timestamp)
    }

    // Confirm artifact event links correctly
    const screenshotEvent = timeline.find((e) => e.type === 'screenshot')
    expect(screenshotEvent).toBeDefined()
    expect(screenshotEvent?.artifactUri).toContain('/screenshots/login-page.png')
  })

  it('ExecutionReplayEngine constructs stepped replay frames without executing live actions', () => {
    const replay = new ExecutionReplayEngine(executionId, mockJournalEntries, mockArtifacts)

    expect(replay.getExecutionId()).toBe(executionId)
    expect(replay.getTotalSteps()).toBe(8)

    // Verify early frame before screenshot was taken
    const frame0 = replay.getFrame(0)
    expect(frame0?.stepIndex).toBe(0)
    expect(frame0?.screenshotUri).toBeUndefined()

    // Verify frame after screenshot was taken carries forward the latest screenshot state
    const frameAfterScreenshot = replay.getFrame(4)
    expect(frameAfterScreenshot?.screenshotUri).toBe(`artifact://${executionId}/screenshots/login-page.png`)
    expect(frameAfterScreenshot?.domSnapshotUri).toBe(`artifact://${executionId}/dom/login-page.html`)
    expect(frameAfterScreenshot?.activeTaskTitle).toBe('Task t-1')
  })
})
