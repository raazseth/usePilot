// ExecutionService — facade mirroring PlannerService

import type { ServerWebSocket } from 'bun'
import { generateId } from '@usepilot/utils'
import {
  createDefaultRegistry,
  createExecutionRunner,
  ExecutionJournal,
  CheckpointManager,
  ExecutionMetricsCollector,
  TaskScheduler,
  ExecutionStateMachine,
  ApprovalGate,
  RetryEngine,
  ExecutionRunner,
} from '@usepilot/execution-core'
import type { ExecutionResult } from '@usepilot/execution-types'
import type { EventBus } from '../events/bus'
import type { Logger } from '../logger'
import { ExecutionPersistence } from './persistence'
import { ExecutionEvents } from './events'
import { PlanRepository } from '@usepilot/database'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

interface ActiveExecution {
  runner: ExecutionRunner
  approvalGate: ApprovalGate
  traceId: string
}

export class ExecutionService {
  private readonly persistence: ExecutionPersistence
  private readonly events: ExecutionEvents
  private readonly planRepo: PlanRepository
  private readonly activeExecutions = new Map<string, ActiveExecution>()

  constructor(
    db: DB,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {
    this.persistence = new ExecutionPersistence(db)
    this.events = new ExecutionEvents(eventBus)
    this.planRepo = new PlanRepository(db)
  }

  async startExecution(ws: WS, planId: string): Promise<void> {
    const childLogger = this.logger.child({ planId, action: 'startExecution' })

    const planRow = await this.planRepo.findById(planId)
    if (!planRow) {
      this.events.send(ws, {
        type: 'execution.error',
        payload: { code: 'PLAN_NOT_FOUND', message: `Plan ${planId} not found` },
      })
      return
    }

    const blueprint = this.planRepo.parseBlueprint(planRow)
    const traceId = generateId()
    const registry = createDefaultRegistry()
    const approvalGate = new ApprovalGate({ timeoutMs: 5 * 60 * 1000 })
    const runId = generateId()

    const osPlatform: 'windows' | 'macos' | 'linux' =
      process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux'
    const snapshot: import('@usepilot/execution-types').ExecutionContextSnapshot = {
      runId,
      blueprintHash: blueprint.hash,
      plannerVersion: '0.2.0',
      executionVersion: '0.3.0',
      platform: {
        os: osPlatform,
        arch: process.arch,
        runtime: 'Bun' in globalThis ? 'bun' : 'node',
        nodeVersion: process.version,
      },
      environment: {},
      registeredAdapters: registry.listRegistered().map((r) => ({
        name: r.name,
        capability: r.capability,
        priority: r.priority,
      })),
      permissions: ['filesystem', 'network'],
      createdAt: Date.now(),
    }

    const runRow = await this.persistence.createRun({
      planId,
      blueprintHash: blueprint.hash,
      traceId,
      tasksTotal: blueprint.tasks.length,
      contextSnapshot: JSON.stringify(snapshot),
    })

    childLogger.info({ runId, traceId, taskCount: blueprint.tasks.length }, 'Execution started')
    await this.events.emitStarted(ws, runId, planId, traceId, blueprint.tasks.length)

    // Build runner with DB-backed journal + checkpoints
    const dbJournalBackend = {
      append: async (entry: import('@usepilot/execution-types').JournalEntry) => {
        await this.persistence.appendJournal(entry)
      },
      getByRun: async (runId: string): Promise<import('@usepilot/execution-types').JournalEntry[]> => {
        const rows = await this.persistence.journalRepo.getByRun(runId)
        return rows.map(r => ({
          id: r.id,
          runId: r.runId,
          traceId: r.traceId,
          taskId: r.taskId ?? undefined,
          eventType: r.eventType as import('@usepilot/execution-types').JournalEventType,
          adapterName: r.adapterName ?? undefined,
          stateFrom: r.stateFrom ?? undefined,
          stateTo: r.stateTo ?? undefined,
          attemptNumber: r.attemptNumber ?? undefined,
          payload: JSON.parse(r.payload) as Record<string, unknown>,
          timestamp: r.timestamp,
        }))
      },
    }

    const dbCheckpointBackend = {
      save: async (checkpoint: import('@usepilot/execution-types').ExecutionCheckpoint) => {
        await this.persistence.saveCheckpoint(checkpoint)
      },
      restore: async (runId: string) => this.persistence.restoreCheckpoint(runId),
      list: async (runId: string): Promise<import('@usepilot/execution-types').ExecutionCheckpoint[]> => {
        const rows = await this.persistence.checkpointRepo.listByRun(runId)
        return rows.map(r => ({
          id: r.id, runId: r.runId, createdAt: r.createdAt,
          executionStatus: r.executionStatus as import('@usepilot/execution-types').ExecutionStatus,
          completedTaskIds: JSON.parse(r.completedTaskIds) as string[],
          pendingTaskIds: JSON.parse(r.pendingTaskIds) as string[],
          failedTaskIds: JSON.parse(r.failedTaskIds) as string[],
          skippedTaskIds: JSON.parse(r.skippedTaskIds) as string[],
          retryCounters: JSON.parse(r.retryCounters) as Record<string, number>,
          pendingApprovalTaskId: r.pendingApprovalTaskId ?? undefined,
          metadata: JSON.parse(r.metadata) as Record<string, unknown>,
        }))
      },
    }

    const journal = new ExecutionJournal(dbJournalBackend)
    const checkpoints = new CheckpointManager(runId, dbCheckpointBackend)
    const metrics = new ExecutionMetricsCollector(runId, traceId)

    const deps = {
      registry,
      scheduler: new TaskScheduler(),
      stateMachine: new ExecutionStateMachine(),
      approvalGate,
      retryEngine: new RetryEngine(),
      journal,
      checkpoints,
      metrics,
    }

    const runner = new ExecutionRunner(deps)
    this.activeExecutions.set(runId, { runner, approvalGate, traceId })

    const callbacks: import('@usepilot/execution-core').ExecutionCallbacks = {
      onTaskStarted: async (taskId, taskTitle, capability, attempt) => {
        await this.events.emitTaskStarted(ws, runId, traceId, taskId, taskTitle, capability, attempt)
      },
      onTaskCompleted: async (taskId, durationMs, verified) => {
        await this.events.emitTaskCompleted(ws, runId, traceId, taskId, durationMs, verified)
      },
      onTaskFailed: async (taskId, error, failureCategory, attempt) => {
        await this.events.emitTaskFailed(ws, runId, traceId, taskId, failureCategory, error, attempt)
      },
      onTaskRetrying: async (taskId, attempt, backoffMs) => {
        await this.events.emitTaskRetrying(ws, runId, traceId, taskId, attempt, backoffMs)
      },
      onTaskSkipped: async (taskId, reason) => {
        await this.events.emitTaskSkipped(ws, runId, traceId, taskId, reason)
      },
      onApprovalRequired: async (runId, traceId, task) => {
        const request = approvalGate.getPendingRequest(task.id)
        if (request) {
          await this.persistence.saveApproval(request)
          await this.events.emitApprovalRequired(ws, request)
        }
      },
      onApprovalResolved: async (taskId, approved) => {
        await this.events.emitApprovalReceived(ws, runId, traceId, taskId, approved)
      },
      onProgress: async (completed, total, currentTaskTitle) => {
        await this.events.emitProgress(ws, runId, traceId, completed, total, currentTaskTitle)
      },
      onPaused: async () => {
        await this.events.emitPaused(ws, runId, traceId)
      },
      onResumed: async () => {
        await this.events.emitResumed(ws, runId, traceId)
      },
      onCompleted: async (result) => {
        await this.persistence.markRunCompleted(runId, result.tasksCompleted, result.tasksFailed, result.tasksSkipped)
        await this.persistence.saveReport(result.report)
        if (result.manifest) {
          await this.persistence.saveManifest(result.manifest)
        }
        await this.events.emitCompleted(ws, result)
        this.activeExecutions.delete(runId)
      },
      onFailed: async (runId, error, failedTaskId) => {
        await this.persistence.markRunFailed(runId, 'EXECUTION_FAILED')
        await this.events.emitFailed(ws, runId, traceId, 'EXECUTION_FAILED', failedTaskId)
        this.activeExecutions.delete(runId)
      },
    }

    void runner
      .run(runId, traceId, blueprint, {
        platform: osPlatform,
        callbacks,
        contextSnapshot: snapshot,
      })
      .catch((err: unknown) => {
        childLogger.error({ err, runId }, 'ExecutionRunner threw unexpectedly')
      })
  }

  approveTask(ws: WS, runId: string, taskId: string, approved: boolean, comment?: string): void {
    const active = this.activeExecutions.get(runId)
    if (!active) {
      this.events.send(ws, { type: 'execution.error', payload: { code: 'RUN_NOT_FOUND', message: `No active execution for run ${runId}` } })
      return
    }

    const resolved = active.approvalGate.resolve(taskId, {
      requestId: generateId(),
      taskId,
      approved,
      comment,
      respondedAt: Date.now(),
    })

    if (!resolved) {
      this.events.send(ws, { type: 'execution.error', payload: { code: 'APPROVAL_NOT_PENDING', message: `No pending approval for task ${taskId}` } })
    }
  }

  cancelExecution(ws: WS, runId: string): void {
    const active = this.activeExecutions.get(runId)
    if (!active) return
    active.runner.cancel()
    this.activeExecutions.delete(runId)
  }

  pauseExecution(ws: WS, runId: string): void {
    const active = this.activeExecutions.get(runId)
    if (!active) return
    active.runner.pause()
  }

  resumeExecution(ws: WS, runId: string): void {
    const active = this.activeExecutions.get(runId)
    if (!active) return
    active.runner.resume()
  }

  async getExecutionStatus(ws: WS, runId: string): Promise<void> {
    const report = await this.persistence.getReport(runId)
    this.events.send(ws, {
      type: 'execution.status',
      payload: { runId, active: this.activeExecutions.has(runId), report },
    })
  }

  async getExecutionManifest(ws: WS, runId: string): Promise<void> {
    const manifest = await this.persistence.getManifest(runId)
    this.events.send(ws, {
      type: 'execution.status',
      payload: { runId, manifest },
    })
  }
}
