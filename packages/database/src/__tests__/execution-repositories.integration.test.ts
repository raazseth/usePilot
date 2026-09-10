import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { unlinkSync, existsSync } from 'fs'
import { generateId } from '@usepilot/utils'
import { createDatabase } from '../client'
import { migrate } from '../migrate'
import { seed } from '../seed'
import { ConversationRepository } from '../repositories/conversations'
import { GoalRepository } from '../repositories/goals'
import { PlannerRunRepository } from '../repositories/planner-runs'
import { PlanRepository } from '../repositories/plans'
import { ExecutionRunRepository } from '../repositories/execution-runs'
import { ExecutionTaskRecordRepository } from '../repositories/execution-task-records'
import { ExecutionJournalRepository } from '../repositories/execution-journal'
import { ExecutionCheckpointRepository } from '../repositories/execution-checkpoints'
import { ApprovalRequestRepository } from '../repositories/approval-requests'
import { ExecutionReportRepository } from '../repositories/execution-reports'
import { ExecutionManifestRepository } from '../repositories/execution-manifests'

describe('Execution Repositories Integration Tests', () => {
  const testDbPath = join(tmpdir(), `usepilot-exec-test-${generateId()}.db`)
  let db: ReturnType<typeof createDatabase>
  let planId: string

  let runRepo: ExecutionRunRepository
  let taskRepo: ExecutionTaskRecordRepository
  let journalRepo: ExecutionJournalRepository
  let checkpointRepo: ExecutionCheckpointRepository
  let approvalRepo: ApprovalRequestRepository
  let reportRepo: ExecutionReportRepository
  let manifestRepo: ExecutionManifestRepository

  beforeEach(async () => {
    await migrate(testDbPath)
    await seed(testDbPath)
    db = createDatabase(testDbPath)

    const convRepo = new ConversationRepository(db)
    const goalRepo = new GoalRepository(db)
    const plannerRunsRepo = new PlannerRunRepository(db)
    const planRepo = new PlanRepository(db)

    const conv = await convRepo.create({ title: 'Test Plan Conversation' })
    const goal = await goalRepo.create({
      conversationId: conv.id,
      rawText: 'Test goal',
      normalizedText: 'Test goal',
      primaryObjective: 'Test goal',
      expectedOutcome: 'Done',
      constraints: [],
      requiredResources: [],
      confidence: 1,
    })
    const pRun = await plannerRunsRepo.create({
      goalId: goal.id,
      conversationId: conv.id,
    })
    const plan = await planRepo.create({
      runId: pRun.id,
      goalId: goal.id,
      conversationId: conv.id,
      version: 1,
      status: 'ready',
      hash: 'hash-123',
      executionBlueprint: {
        id: 'bp-1',
        version: 1,
        hash: 'hash-123',
        goal: {
          id: goal.id,
          primaryObjective: 'Test goal',
          expectedOutcome: 'Done',
        },
        intent: { type: 'system_task', description: 'Test', confidence: 1, riskLevel: 'low' },
        tasks: [],
        graph: { nodes: [], edges: [], parallelGroups: [] },
        approvals: { policy: 'automatic', mandatoryTaskIds: [], hasForbiddenTasks: false },
        successCriteria: [],
        estimatedComplexity: 'low',
        status: 'ready',
        createdAt: Date.now(),
      } as any,
    })
    planId = plan.id

    runRepo = new ExecutionRunRepository(db)
    taskRepo = new ExecutionTaskRecordRepository(db)
    journalRepo = new ExecutionJournalRepository(db)
    checkpointRepo = new ExecutionCheckpointRepository(db)
    approvalRepo = new ApprovalRequestRepository(db)
    reportRepo = new ExecutionReportRepository(db)
    manifestRepo = new ExecutionManifestRepository(db)
  })

  afterEach(() => {
    try {
      if (existsSync(testDbPath)) unlinkSync(testDbPath)
      if (existsSync(`${testDbPath}-wal`)) unlinkSync(`${testDbPath}-wal`)
      if (existsSync(`${testDbPath}-shm`)) unlinkSync(`${testDbPath}-shm`)
    } catch {
      // Best effort cleanup
    }
  })

  it('creates an execution run, transitions status, and logs journal entries', async () => {
    const traceId = generateId()
    const run = await runRepo.create({
      planId,
      blueprintHash: 'hash-123',
      traceId,
      tasksTotal: 3,
    })
    expect(run.id).toBeDefined()
    expect(run.status).toBe('created')

    await runRepo.updateStatus(run.id, 'running')
    const running = await runRepo.findById(run.id)
    expect(running?.status).toBe('running')

    await journalRepo.append({
      runId: run.id,
      traceId,
      taskId: 't-1',
      eventType: 'task_started',
      adapterName: 'NativeFilesystemAdapter',
      payload: { attempt: 1 },
      timestamp: Date.now(),
    })

    const journal = await journalRepo.getByRun(run.id)
    expect(journal.length).toBe(1)
    expect(journal[0]?.eventType).toBe('task_started')

    await checkpointRepo.save({
      runId: run.id,
      createdAt: Date.now(),
      executionStatus: 'running',
      completedTaskIds: ['t-1'],
      pendingTaskIds: ['t-2', 't-3'],
      failedTaskIds: [],
      skippedTaskIds: [],
      retryCounters: {},
      metadata: {},
    })

    const checkpoint = await checkpointRepo.getLatest(run.id)
    expect(checkpoint).not.toBeNull()
    expect(checkpoint?.completedTaskIds).toContain('t-1')

    await runRepo.markCompleted(run.id, 3, 0, 0)
    const completed = await runRepo.findById(run.id)
    expect(completed?.status).toBe('completed')
  })

  it('handles approval requests, reports, and manifests lifecycle', async () => {
    const traceId = generateId()
    const run = await runRepo.create({
      planId,
      blueprintHash: 'hash-123',
      traceId,
      tasksTotal: 1,
    })

    const approval = await approvalRepo.create({
      id: generateId(),
      runId: run.id,
      taskId: 'task-auth',
      taskTitle: 'Authenticate to bank',
      capability: 'authenticate_user',
      approvalReason: 'High risk operation',
      policy: 'mandatory',
      requestedAt: Date.now(),
    })
    expect(approval.id).toBeDefined()

    await approvalRepo.resolve(approval.id, {
      requestId: approval.id,
      taskId: 'task-auth',
      approved: true,
      comment: 'Approved by user',
      respondedAt: Date.now(),
    })

    const approvals = await approvalRepo.findByRunId(run.id)
    const resolved = approvals.find((a) => a.id === approval.id)
    expect(resolved?.approved).toBe(true)
    expect(resolved?.comment).toBe('Approved by user')

    await reportRepo.save({
      runId: run.id,
      traceId,
      summary: '1/1 tasks completed',
      taskSummaries: [],
      failureCategories: [],
      metrics: {
        totalDurationMs: 500,
        taskDurations: {},
        adapterSelectionCounts: {},
        retryCount: 0,
        recoveryCount: 0,
        checkpointCount: 1,
        approvalLatencyMs: 200,
        verificationLatencyMs: 50,
      } as any,
      createdAt: Date.now(),
    })

    const report = await reportRepo.findByRunId(run.id)
    expect(report).not.toBeNull()
    expect(report?.summary).toBe('1/1 tasks completed')

    await manifestRepo.save({
      runId: run.id,
      traceId,
      blueprintHash: 'hash-123',
      plannerVersion: '0.2.0',
      executionVersion: '0.3.0',
      policy: {} as any,
      capabilities: ['authenticate_user'],
      selectedAdapters: [],
      environment: { os: 'windows', arch: 'x64', runtime: 'bun', nodeVersion: 'v22.0.0' },
      startedAt: Date.now() - 1000,
      completedAt: Date.now(),
      tasksSummary: { total: 1, completed: 1, failed: 0, skipped: 0 },
      outcome: 'success',
      manifestHash: 'sha256-abc',
    } as any)

    const manifest = await manifestRepo.findByRunId(run.id)
    expect(manifest).not.toBeNull()
    expect(manifest?.outcome).toBe('success')
  })
})
