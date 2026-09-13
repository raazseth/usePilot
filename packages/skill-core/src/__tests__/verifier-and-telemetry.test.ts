import { describe, it, expect } from 'vitest'
import { SkillVerifier } from '../verification/skill-verifier'
import { SkillTelemetryCollector } from '../telemetry/skill-telemetry'
import { OrganizeDownloadsSkill } from '../skills/filesystem/organize-downloads'
import type { ExecutionResult } from '@usepilot/execution-types'

describe('SkillVerifier and Telemetry', () => {
  const verifier = new SkillVerifier()
  const telemetry = new SkillTelemetryCollector()

  it('evaluates failed execution result as unverified', () => {
    const failedRun: ExecutionResult = {
      runId: 'exec-123',
      traceId: 'trace-123',
      status: 'failed',
      durationMs: 5000,
      tasksCompleted: 1,
      tasksFailed: 1,
      tasksSkipped: 1,
      report: {
        runId: 'exec-123',
        traceId: 'trace-123',
        summary: 'Disk full error encountered during move',
        taskSummaries: [],
        failureCategories: ['adapter_failure'],
        metrics: {
          runId: 'exec-123',
          traceId: 'trace-123',
          totalDurationMs: 5000,
          taskDurations: {},
          adapterSelections: {},
          verificationLatencies: {},
          retryCount: 0,
          approvalWaitTimeMs: 0,
          checkpointCount: 0,
          journalEntryCount: 0,
          cancellationCount: 0,
          recoveryCount: 0,
        },
        createdAt: Date.now(),
      },
    }

    const verification = verifier.verify(
      OrganizeDownloadsSkill,
      { folder: 'C:/Test/Downloads' },
      failedRun
    )

    expect(verification.verified).toBe(false)
    expect(verification.error).toContain('failed')
  })

  it('records execution telemetry and calculates correct metrics', () => {
    telemetry.record({
      skillId: 'organize-downloads',
      skillVersion: '1.0.0',
      runId: 'run-001',
      workflowId: 'wf-001',
      executionId: 'exec-001',
      startedAt: Date.now() - 1250,
      completedAt: Date.now(),
      durationMs: 1250,
      success: true,
      verificationSuccess: true,
      retryCount: 0,
      approvalRequired: false,
      approvalGranted: false,
      tasksTotal: 3,
      tasksCompleted: 3,
      tasksFailed: 0,
    })

    telemetry.record({
      skillId: 'organize-downloads',
      skillVersion: '1.0.0',
      runId: 'run-002',
      workflowId: 'wf-002',
      executionId: 'exec-002',
      startedAt: Date.now() - 2500,
      completedAt: Date.now(),
      durationMs: 2500,
      success: false,
      verificationSuccess: false,
      retryCount: 2,
      failureCategory: 'permission_denied',
      approvalRequired: true,
      approvalGranted: false,
      tasksTotal: 3,
      tasksCompleted: 1,
      tasksFailed: 1,
    })

    const metrics = telemetry.getMetrics('organize-downloads')
    expect(metrics).toBeDefined()
    expect(metrics?.totalExecutions).toBe(2)
    expect(metrics?.successRate).toBe(0.5)
    expect(metrics?.avgDurationMs).toBe(1875)
    expect(metrics?.failureCategories['permission_denied']).toBe(1)
  })
})
