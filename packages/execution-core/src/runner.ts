// ExecutionRunner — orchestrates the full execution lifecycle

import type {
  ExecutionResult,
  ExecutionReport,
  TaskSummary,
  FailureCategory,
  TaskExecutionStatus,
  ExecutionContextSnapshot,
  ICapabilityNegotiator,
  ICapabilityAdapter,
  ExecutionPolicy,
  IExecutionPolicyEngine,
  ISessionManager,
  SelectedAdapterRecord,
  ExecutionManifest,
} from '@usepilot/execution-types'
import type { ExecutionBlueprint, Task } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'

import type { ApprovalGate } from './approval-gate'
import type { CheckpointManager } from './checkpoint'
import type { ExecutionJournal } from './journal'
import { ManifestGenerator } from './manifest/generator'
import type { ExecutionMetricsCollector } from './metrics'
import { PolicyBasedCapabilityNegotiator } from './negotiator'
import { ExecutionPolicyEngine } from './policy/engine'
import type { CapabilityRegistry } from './registry'
import { ExecutionResourceManager } from './resource-manager'
import { RetryEngine } from './retry'
import { AdapterSandbox } from './sandbox'
import type { TaskScheduler } from './scheduler'
import type { ExecutionStateMachine } from './state-machine'
import { CancellationTokenSource } from './token'
import { SessionManager } from './session/manager'

export interface ExecutionCallbacks {
  onTaskStarted?: (taskId: string, taskTitle: string, capability: string, attempt: number) => void | Promise<void>
  onTaskCompleted?: (taskId: string, durationMs: number, verified: boolean) => void | Promise<void>
  onTaskFailed?: (taskId: string, error: string, failureCategory: FailureCategory, attempt: number) => void | Promise<void>
  onTaskRetrying?: (taskId: string, attempt: number, backoffMs: number) => void | Promise<void>
  onTaskSkipped?: (taskId: string, reason: string) => void | Promise<void>
  onApprovalRequired?: (runId: string, traceId: string, task: Task) => void | Promise<void>
  onApprovalResolved?: (taskId: string, approved: boolean) => void | Promise<void>
  onProgress?: (completed: number, total: number, currentTaskTitle: string) => void | Promise<void>
  onPaused?: (runId: string) => void | Promise<void>
  onResumed?: (runId: string) => void | Promise<void>
  onCompleted?: (result: ExecutionResult) => void | Promise<void>
  onFailed?: (runId: string, error: string, failedTaskId?: string) => void | Promise<void>
}

export interface RunOptions {
  platform?: 'windows' | 'macos' | 'linux'
  callbacks?: ExecutionCallbacks
  contextSnapshot?: ExecutionContextSnapshot
  policy?: Partial<ExecutionPolicy>
}

export interface RunnerDependencies {
  registry: CapabilityRegistry
  scheduler: TaskScheduler
  stateMachine: ExecutionStateMachine
  approvalGate: ApprovalGate
  retryEngine?: RetryEngine
  journal: ExecutionJournal
  checkpoints: CheckpointManager
  metrics: ExecutionMetricsCollector
  sandbox?: AdapterSandbox
  negotiator?: ICapabilityNegotiator
  resourceManager?: ExecutionResourceManager
  policyEngine?: ExecutionPolicyEngine
  sessionManager?: ISessionManager
}

export class ExecutionRunner {
  private readonly cancellationTokenSource = new CancellationTokenSource()
  private abortController = new AbortController()
  private pausePromise: Promise<void> | null = null
  private pauseResolve: (() => void) | null = null
  private readonly sandbox: AdapterSandbox
  private readonly negotiator: ICapabilityNegotiator
  private readonly resourceManager: ExecutionResourceManager
  private readonly policyEngine: ExecutionPolicyEngine
  private readonly sessionManager: ISessionManager

  constructor(private readonly deps: RunnerDependencies) {
    this.sandbox = deps.sandbox ?? new AdapterSandbox()
    this.negotiator = deps.negotiator ?? new PolicyBasedCapabilityNegotiator()
    this.resourceManager = deps.resourceManager ?? new ExecutionResourceManager()
    this.policyEngine = deps.policyEngine ?? new ExecutionPolicyEngine()
    this.sessionManager =
      deps.sessionManager ??
      new SessionManager(
        { defaultScope: this.policyEngine.getSessionScope('execute_command') },
        { sandbox: this.sandbox, resourceManager: this.resourceManager }
      )
  }

  async run(
    runId: string,
    traceId: string,
    blueprint: ExecutionBlueprint,
    options: RunOptions = {}
  ): Promise<ExecutionResult> {
    const { registry, scheduler, stateMachine, approvalGate, journal, checkpoints, metrics } = this.deps
    const platform = options.platform ?? 'windows'
    const callbacks = options.callbacks ?? {}
    const policyEngine = options.policy ? new ExecutionPolicyEngine(options.policy) : this.policyEngine
    const retryEngine = this.deps.retryEngine ?? new RetryEngine(this.sandbox, undefined, policyEngine)
    const selectedAdapters: SelectedAdapterRecord[] = []

    // 1. Capture ExecutionContextSnapshot
    const snapshot: ExecutionContextSnapshot = options.contextSnapshot ?? {
      runId,
      blueprintHash: blueprint.hash,
      plannerVersion: '0.2.0',
      executionVersion: '0.3.0',
      platform: {
        os: platform,
        arch: typeof process !== 'undefined' ? process.arch : 'unknown',
        runtime: 'Bun' in globalThis ? 'bun' : 'node',
        nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
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

    const taskMap = new Map(blueprint.tasks.map((t) => [t.id, t]))
    const completedTaskIds = new Set<string>()
    const failedTaskIds = new Set<string>()
    const skippedTaskIds = new Set<string>()
    const retryCounters: Record<string, number> = {}
    const taskSummaries: TaskSummary[] = []

    // Initialize all tasks
    for (const task of blueprint.tasks) {
      stateMachine.initializeTask(task.id)
    }

    // Check for existing checkpoint
    const checkpoint = await checkpoints.restore()
    if (checkpoint) {
      metrics.recordRecovery()
      checkpoint.completedTaskIds.forEach((id) => completedTaskIds.add(id))
      checkpoint.failedTaskIds.forEach((id) => failedTaskIds.add(id))
      checkpoint.skippedTaskIds.forEach((id) => skippedTaskIds.add(id))
      Object.assign(retryCounters, checkpoint.retryCounters)

      await journal.log(runId, traceId, 'checkpoint_restored', {
        checkpointId: checkpoint.id,
        completedCount: completedTaskIds.size,
      })
    }

    stateMachine.transitionExecution('running')
    await journal.log(runId, traceId, 'execution_started', {
      blueprintId: blueprint.id,
      blueprintHash: blueprint.hash,
      taskCount: blueprint.tasks.length,
      snapshot,
    })

    const batches = scheduler.schedule(blueprint)
    const total = blueprint.tasks.length
    let currentCompleted = completedTaskIds.size

    for (const batch of batches) {
      // Skip already-completed batches (checkpoint resume)
      const allDone = batch.tasks.every(
        (t) => completedTaskIds.has(t.id) || skippedTaskIds.has(t.id) || failedTaskIds.has(t.id)
      )
      if (allDone) continue

      // Pause check
      if (this.pausePromise) {
        stateMachine.transitionExecution('paused')
        await journal.log(runId, traceId, 'execution_paused', {})
        await callbacks.onPaused?.(runId)
        await this.pausePromise
        stateMachine.transitionExecution('running')
        await journal.log(runId, traceId, 'execution_resumed', {})
        await callbacks.onResumed?.(runId)
      }

      if (this.abortController.signal.aborted) break

      const runTask = async (task: Task): Promise<void> => {
        if (
          completedTaskIds.has(task.id) ||
          skippedTaskIds.has(task.id) ||
          failedTaskIds.has(task.id)
        ) return

        // Check dependencies
        const unmetDep = task.dependsOn.find(
          (depId) => !completedTaskIds.has(depId) && !skippedTaskIds.has(depId)
        )
        if (unmetDep && failedTaskIds.has(unmetDep)) {
          stateMachine.transitionTask(task.id, 'skipped')
          skippedTaskIds.add(task.id)
          taskSummaries.push({
            taskId: task.id,
            taskTitle: task.title,
            capability: task.requiredCapability,
            status: 'skipped',
            attemptCount: 0,
            failureCategory: 'dependency_failure',
          })
          await callbacks.onTaskSkipped?.(task.id, `Dependency "${unmetDep}" failed`)
          await journal.log(runId, traceId, 'task_skipped', { reason: 'dependency_failure' }, { taskId: task.id })
          return
        }

        // Policy-driven approval gate
        const approvalReq = policyEngine.getApprovalRequirement(task)
        if (approvalReq.required) {
          stateMachine.transitionTask(task.id, 'waiting_approval')
          stateMachine.transitionExecution('waiting_approval')
          metrics.recordApprovalStarted()

          // Save checkpoint before emitting approval event (survives restart)
          await checkpoints.save({
            executionStatus: 'waiting_approval',
            completedTaskIds: Array.from(completedTaskIds),
            pendingTaskIds: batch.tasks.map((t) => t.id).filter((id) => !completedTaskIds.has(id)),
            failedTaskIds: Array.from(failedTaskIds),
            skippedTaskIds: Array.from(skippedTaskIds),
            retryCounters,
            pendingApprovalTaskId: task.id,
          })
          metrics.recordCheckpoint()

          await journal.log(runId, traceId, 'approval_requested', {
            taskId: task.id,
            policy: task.approvalPolicy,
            reason: approvalReq.reason,
          }, { taskId: task.id })
          await callbacks.onApprovalRequired?.(runId, traceId, task)

          let response
          try {
            response = await approvalGate.requestApproval(runId, traceId, task)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Approval failed'
            metrics.recordApprovalResolved()
            stateMachine.transitionTask(task.id, 'failed')
            failedTaskIds.add(task.id)
            taskSummaries.push({
              taskId: task.id, taskTitle: task.title,
              capability: task.requiredCapability, status: 'failed',
              attemptCount: 0, failureCategory: 'timeout',
            })
            await journal.log(runId, traceId, 'approval_received', { approved: false, reason: msg }, { taskId: task.id })
            return
          }

          metrics.recordApprovalResolved()
          await journal.log(runId, traceId, 'approval_received', { approved: response.approved, comment: response.comment }, { taskId: task.id })
          await callbacks.onApprovalResolved?.(task.id, response.approved)

          if (!response.approved) {
            stateMachine.transitionTask(task.id, 'failed')
            failedTaskIds.add(task.id)
            taskSummaries.push({
              taskId: task.id, taskTitle: task.title,
              capability: task.requiredCapability, status: 'failed',
              attemptCount: 0, failureCategory: 'approval_denied',
            })
            if (task.failureStrategy.onFailure === 'abort') {
              throw Object.assign(new Error(`Task "${task.title}" approval denied`), {
                code: 'APPROVAL_DENIED', taskId: task.id,
              })
            }
            return
          }

          stateMachine.transitionTask(task.id, 'ready')
          stateMachine.transitionExecution('running')
        }

        // Negotiate & resolve adapter
        stateMachine.transitionTask(task.id, 'running')
        const taskStart = Date.now()
        await callbacks.onTaskStarted?.(task.id, task.title, task.requiredCapability, retryCounters[task.id] ?? 1)

        let adapter: ICapabilityAdapter | undefined
        let session: import('@usepilot/execution-types').IAdapterSession | undefined
        let negotiationDecision: import('@usepilot/execution-types').NegotiationResult | undefined
        try {
          const negotiated = await registry.negotiate(task, blueprint, platform, this.negotiator)
          const resolvedAdapter = negotiated.adapter
          adapter = resolvedAdapter
          negotiationDecision = negotiated.decision

          const sessionScope = policyEngine.getSessionScope(task.requiredCapability)
          session = await this.sessionManager.getOrCreateSession(
            runId,
            task.requiredCapability,
            resolvedAdapter,
            sessionScope
          )

          selectedAdapters.push({
            taskId: task.id,
            capability: task.requiredCapability,
            adapterName: adapter.name,
            sessionId: session.id,
          })

          metrics.recordAdapterSelection(task.id, adapter.name)
          await journal.log(runId, traceId, 'adapter_selected', {
            adapterName: adapter.name,
            capability: task.requiredCapability,
            sessionId: session.id,
            rationale: negotiationDecision.rationale,
            candidatesEvaluated: negotiationDecision.candidatesEvaluated,
          }, { taskId: task.id })
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Adapter resolution failed'
          stateMachine.transitionTask(task.id, 'failed')
          failedTaskIds.add(task.id)
          taskSummaries.push({
            taskId: task.id, taskTitle: task.title,
            capability: task.requiredCapability, status: 'failed',
            attemptCount: 1, failureCategory: 'configuration',
          })
          await callbacks.onTaskFailed?.(task.id, msg, 'configuration', 1)
          await journal.log(runId, traceId, 'task_failed', { error: msg, failureCategory: 'configuration' }, { taskId: task.id })
          return
        }

        const taskToken = this.cancellationTokenSource.createChild()
        const adapterCtx = {
          task,
          blueprint,
          runId,
          traceId,
          signal: taskToken.token.signal,
        }

        let retryResult
        try {
          retryResult = await retryEngine.run(task, session, adapterCtx, blueprint, async (attempt, backoffMs) => {
            retryCounters[task.id] = (retryCounters[task.id] ?? 0) + 1
            metrics.recordRetry()
            stateMachine.transitionTask(task.id, 'retrying')
            await callbacks.onTaskRetrying?.(task.id, attempt, backoffMs)
            await journal.log(runId, traceId, 'task_retrying', { attempt, backoffMs }, { taskId: task.id, attemptNumber: attempt })
            stateMachine.transitionTask(task.id, 'running')
          })
        } finally {
          taskToken.dispose()
        }

        const taskDuration = Date.now() - taskStart
        metrics.recordTaskDuration(task.id, taskDuration)
        metrics.recordVerificationLatency(task.id, retryResult.verificationResult.durationMs)

        await journal.log(runId, traceId, 'adapter_result', {
          success: retryResult.adapterResult.success,
          attempts: retryResult.attempts,
        }, { taskId: task.id, adapterName: adapter.name })

        await journal.log(runId, traceId, 'verification_result', {
          passed: retryResult.verificationResult.passed,
          checkedCount: retryResult.verificationResult.checkedConditions.length,
        }, { taskId: task.id })

        if (retryResult.succeeded) {
          stateMachine.transitionTask(task.id, 'completed')
          completedTaskIds.add(task.id)
          currentCompleted++
          taskSummaries.push({
            taskId: task.id, taskTitle: task.title,
            capability: task.requiredCapability, status: 'completed',
            attemptCount: retryResult.attempts, durationMs: taskDuration,
          })
          await callbacks.onTaskCompleted?.(task.id, taskDuration, retryResult.verificationResult.passed)
          await callbacks.onProgress?.(currentCompleted, total, task.title)
          await journal.log(runId, traceId, 'task_completed', { durationMs: taskDuration }, { taskId: task.id })
        } else {
          if (this.abortController.signal.aborted || retryResult.adapterResult.failureCategory === 'cancellation') {
            stateMachine.transitionTask(task.id, 'cancelled')
            return
          }

          const failureCategory: FailureCategory = retryResult.verificationResult.passed === false
            ? 'verification_failure'
            : retryResult.adapterResult.failureCategory ?? 'adapter_failure'

          const strategy = task.failureStrategy.onFailure
          if (strategy === 'skip' || (strategy === 'fallback' && !task.failureStrategy.fallbackTaskId)) {
            stateMachine.transitionTask(task.id, 'skipped')
            skippedTaskIds.add(task.id)
            taskSummaries.push({
              taskId: task.id, taskTitle: task.title,
              capability: task.requiredCapability, status: 'skipped',
              attemptCount: retryResult.attempts, durationMs: taskDuration, failureCategory,
            })
            await callbacks.onTaskSkipped?.(task.id, 'Failure strategy: skip')
            await journal.log(runId, traceId, 'task_skipped', { reason: 'Failure strategy: skip' }, { taskId: task.id })
            return
          }

          stateMachine.transitionTask(task.id, 'failed')
          failedTaskIds.add(task.id)
          taskSummaries.push({
            taskId: task.id, taskTitle: task.title,
            capability: task.requiredCapability, status: 'failed',
            attemptCount: retryResult.attempts, durationMs: taskDuration, failureCategory,
          })
          await callbacks.onTaskFailed?.(task.id, retryResult.adapterResult.error ?? 'Unknown', failureCategory, retryResult.attempts)
          await journal.log(runId, traceId, 'task_failed', { failureCategory, attempts: retryResult.attempts }, { taskId: task.id })

          if (strategy === 'abort') {
            throw Object.assign(new Error(`Task "${task.title}" failed: ${retryResult.adapterResult.error}`), {
              code: 'TASK_FAILED', taskId: task.id, failureCategory,
            })
          }
        }
      }

      try {
        if (batch.canParallelize) {
          const maxPar = policyEngine.getMaxParallelism()
          if (maxPar === 1) {
            for (const task of batch.tasks) {
              await runTask(task)
            }
          } else {
            for (let i = 0; i < batch.tasks.length; i += maxPar) {
              const chunk = batch.tasks.slice(i, i + maxPar)
              await Promise.all(chunk.map(runTask))
            }
          }
        } else {
          for (const task of batch.tasks) {
            await runTask(task)
          }
        }
      } catch (err) {
        await this.sessionManager.closeAll()
        await this.resourceManager.cleanupAll()
        if (this.abortController.signal.aborted) {
          metrics.recordCancellation()
          const finalMetrics = metrics.finalize()
          const report = this.buildReport(runId, traceId, blueprint, taskSummaries, failedTaskIds, finalMetrics, snapshot)
          const manifest = await ManifestGenerator.generate({
            runId,
            traceId,
            blueprintHash: blueprint.hash,
            plannerVersion: '0.2.0',
            executionVersion: '0.3.0',
            policy: policyEngine.policy,
            capabilities: blueprint.tasks.map((t) => t.requiredCapability),
            selectedAdapters,
            environment: {
              os: platform,
              arch: typeof process !== 'undefined' ? process.arch : 'unknown',
              runtime: 'Bun' in globalThis ? 'bun' : 'node',
              nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
            },
            startedAt: snapshot.createdAt,
            completedAt: Date.now(),
            tasksSummary: {
              total: blueprint.tasks.length,
              completed: completedTaskIds.size,
              failed: failedTaskIds.size,
              skipped: skippedTaskIds.size,
            },
            outcome: 'cancelled',
          })
          stateMachine.transitionExecution('cancelled')
          await journal.log(runId, traceId, 'execution_cancelled', {})
          return {
            runId,
            traceId,
            status: 'cancelled',
            tasksCompleted: completedTaskIds.size,
            tasksFailed: failedTaskIds.size,
            tasksSkipped: skippedTaskIds.size,
            durationMs: finalMetrics.totalDurationMs,
            report,
            manifest,
          }
        }

        // Abort-level failure from a task
        const finalMetrics = metrics.finalize()
        const report = this.buildReport(runId, traceId, blueprint, taskSummaries, failedTaskIds, finalMetrics, snapshot)
        const manifest = await ManifestGenerator.generate({
          runId,
          traceId,
          blueprintHash: blueprint.hash,
          plannerVersion: '0.2.0',
          executionVersion: '0.3.0',
          policy: policyEngine.policy,
          capabilities: blueprint.tasks.map((t) => t.requiredCapability),
          selectedAdapters,
          environment: {
            os: platform,
            arch: typeof process !== 'undefined' ? process.arch : 'unknown',
            runtime: 'Bun' in globalThis ? 'bun' : 'node',
            nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
          },
          startedAt: snapshot.createdAt,
          completedAt: Date.now(),
          tasksSummary: {
            total: blueprint.tasks.length,
            completed: completedTaskIds.size,
            failed: failedTaskIds.size,
            skipped: skippedTaskIds.size,
          },
          outcome: 'failed',
        })
        stateMachine.transitionExecution('failed')
        await journal.log(runId, traceId, 'execution_failed', { error: err instanceof Error ? err.message : String(err) })

        const failedTaskId = err instanceof Error && 'taskId' in err
          ? (err as { taskId: string }).taskId
          : undefined
        await callbacks.onFailed?.(runId, err instanceof Error ? err.message : String(err), failedTaskId)

        return {
          runId,
          traceId,
          status: 'failed',
          tasksCompleted: completedTaskIds.size,
          tasksFailed: failedTaskIds.size,
          tasksSkipped: skippedTaskIds.size,
          durationMs: finalMetrics.totalDurationMs,
          report,
          manifest,
        }
      }

      // Checkpoint after each batch
      await checkpoints.save({
        executionStatus: 'running',
        completedTaskIds: Array.from(completedTaskIds),
        pendingTaskIds: blueprint.tasks.map((t) => t.id).filter((id) => !completedTaskIds.has(id) && !failedTaskIds.has(id) && !skippedTaskIds.has(id)),
        failedTaskIds: Array.from(failedTaskIds),
        skippedTaskIds: Array.from(skippedTaskIds),
        retryCounters,
      })
      metrics.recordCheckpoint()
    }

    await this.sessionManager.closeAll()
    await this.resourceManager.cleanupAll()

    // Cancelled mid-run
    if (this.abortController.signal.aborted) {
      metrics.recordCancellation()
      const finalMetrics = metrics.finalize()
      const report = this.buildReport(runId, traceId, blueprint, taskSummaries, failedTaskIds, finalMetrics, snapshot)
      const manifest = await ManifestGenerator.generate({
        runId,
        traceId,
        blueprintHash: blueprint.hash,
        plannerVersion: '0.2.0',
        executionVersion: '0.3.0',
        policy: policyEngine.policy,
        capabilities: blueprint.tasks.map((t) => t.requiredCapability),
        selectedAdapters,
        environment: {
          os: platform,
          arch: typeof process !== 'undefined' ? process.arch : 'unknown',
          runtime: 'Bun' in globalThis ? 'bun' : 'node',
          nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
        },
        startedAt: snapshot.createdAt,
        completedAt: Date.now(),
        tasksSummary: {
          total: blueprint.tasks.length,
          completed: completedTaskIds.size,
          failed: failedTaskIds.size,
          skipped: skippedTaskIds.size,
        },
        outcome: 'cancelled',
      })
      stateMachine.transitionExecution('cancelled')
      await journal.log(runId, traceId, 'execution_cancelled', {})

      return {
        runId, traceId, status: 'cancelled',
        tasksCompleted: completedTaskIds.size,
        tasksFailed: failedTaskIds.size,
        tasksSkipped: skippedTaskIds.size,
        durationMs: finalMetrics.totalDurationMs,
        report,
        manifest,
      }
    }

    const finalMetrics = metrics.finalize()
    const report = this.buildReport(runId, traceId, blueprint, taskSummaries, failedTaskIds, finalMetrics, snapshot)
    const hasFailures = failedTaskIds.size > 0 && !this.abortController.signal.aborted

    if (hasFailures) {
      stateMachine.transitionExecution('failed')
      await journal.log(runId, traceId, 'execution_failed', { failedCount: failedTaskIds.size })
      await callbacks.onFailed?.(runId, 'One or more tasks failed')
    } else {
      stateMachine.transitionExecution('completed')
      await journal.log(runId, traceId, 'execution_completed', {
        durationMs: finalMetrics.totalDurationMs,
        tasksCompleted: completedTaskIds.size,
      })
    }

    const manifest = await ManifestGenerator.generate({
      runId,
      traceId,
      blueprintHash: blueprint.hash,
      plannerVersion: '0.2.0',
      executionVersion: '0.3.0',
      policy: policyEngine.policy,
      capabilities: blueprint.tasks.map((t) => t.requiredCapability),
      selectedAdapters,
      environment: {
        os: platform,
        arch: typeof process !== 'undefined' ? process.arch : 'unknown',
        runtime: 'Bun' in globalThis ? 'bun' : 'node',
        nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
      },
      startedAt: snapshot.createdAt,
      completedAt: Date.now(),
      tasksSummary: {
        total: blueprint.tasks.length,
        completed: completedTaskIds.size,
        failed: failedTaskIds.size,
        skipped: skippedTaskIds.size,
      },
      outcome: hasFailures ? 'failed' : 'success',
    })

    const result: ExecutionResult = {
      runId, traceId,
      status: hasFailures ? 'failed' : 'completed',
      tasksCompleted: completedTaskIds.size,
      tasksFailed: failedTaskIds.size,
      tasksSkipped: skippedTaskIds.size,
      durationMs: finalMetrics.totalDurationMs,
      report,
      manifest,
    }

    await callbacks.onCompleted?.(result)
    return result
  }

  pause(): void {
    if (!this.pausePromise) {
      this.pausePromise = new Promise<void>((resolve) => {
        this.pauseResolve = resolve
      })
    }
  }

  resume(): void {
    if (this.pauseResolve) {
      this.pauseResolve()
      this.pausePromise = null
      this.pauseResolve = null
    }
  }

  cancel(): void {
    this.cancellationTokenSource.cancel()
    this.abortController.abort()
    this.resume()
    this.deps.approvalGate.clearAll()
    void this.sessionManager.closeAll()
    void this.resourceManager.cleanupAll()
  }

  private buildReport(
    runId: string,
    traceId: string,
    blueprint: ExecutionBlueprint,
    taskSummaries: TaskSummary[],
    failedTaskIds: Set<string>,
    metrics: ReturnType<ExecutionMetricsCollector['finalize']>,
    snapshot?: ExecutionContextSnapshot
  ): ExecutionReport {
    const failureCategories: FailureCategory[] = Array.from(
      new Set(
        taskSummaries
          .filter((s) => s.failureCategory)
          .map((s) => s.failureCategory!)
      )
    )

    const succeededCount = taskSummaries.filter((s) => s.status === 'completed').length
    const total = taskSummaries.length
    const summary =
      failedTaskIds.size === 0
        ? `Execution completed: ${succeededCount}/${total} tasks succeeded`
        : `Execution finished with failures: ${succeededCount}/${total} tasks succeeded`

    const adapterVersions: Record<string, string> = {}
    for (const a of this.deps.registry.listRegistered()) {
      adapterVersions[a.name] = '0.3.0'
    }

    return {
      runId,
      traceId,
      blueprintHash: blueprint.hash,
      executionHash: `${blueprint.hash}-${runId.slice(0, 8)}`,
      plannerVersion: '0.2.0',
      executionVersion: '0.3.0',
      adapterVersions,
      contextSnapshot: snapshot,
      summary,
      taskSummaries,
      failureCategories,
      metrics,
      createdAt: Date.now(),
    }
  }
}


