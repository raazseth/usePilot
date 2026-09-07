// ExecutionEvents — WS + EventBus, mirrors PlannerEvents

import type { ServerWebSocket } from 'bun'
import type { EventBus } from '../events/bus'
import type { ExecutionResult, ApprovalRequest } from '@usepilot/execution-types'

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

export class ExecutionEvents {
  constructor(private readonly eventBus: EventBus) {}

  send(ws: WS, data: unknown): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(data))
    }
  }

  async emitStarted(ws: WS, runId: string, planId: string, traceId: string, taskCount: number): Promise<void> {
    await this.eventBus.emit('execution.started', { runId, planId, traceId, taskCount })
    this.send(ws, { type: 'execution.started', payload: { runId, planId, traceId, taskCount } })
  }

  async emitProgress(ws: WS, runId: string, traceId: string, completedCount: number, totalCount: number, currentTaskTitle: string): Promise<void> {
    await this.eventBus.emit('execution.progress', { runId, traceId, completedCount, totalCount, currentTaskTitle })
    this.send(ws, { type: 'execution.progress', payload: { runId, traceId, completedCount, totalCount, currentTaskTitle } })
  }

  async emitTaskStarted(ws: WS, runId: string, traceId: string, taskId: string, taskTitle: string, capability: string, attempt: number): Promise<void> {
    await this.eventBus.emit('execution.task.started', { runId, traceId, taskId, taskTitle, capability, attempt })
    this.send(ws, { type: 'execution.task.started', payload: { runId, traceId, taskId, taskTitle, capability, attempt } })
  }

  async emitTaskCompleted(ws: WS, runId: string, traceId: string, taskId: string, durationMs: number, verificationPassed: boolean): Promise<void> {
    await this.eventBus.emit('execution.task.completed', { runId, traceId, taskId, durationMs, verificationPassed })
    this.send(ws, { type: 'execution.task.completed', payload: { runId, traceId, taskId, durationMs, verificationPassed } })
  }

  async emitTaskFailed(ws: WS, runId: string, traceId: string, taskId: string, failureCategory: string, error: string, attempt: number): Promise<void> {
    await this.eventBus.emit('execution.task.failed', { runId, traceId, taskId, failureCategory, error, attempt })
    this.send(ws, { type: 'execution.task.failed', payload: { runId, traceId, taskId, failureCategory, error, attempt } })
  }

  async emitTaskRetrying(ws: WS, runId: string, traceId: string, taskId: string, attempt: number, backoffMs: number): Promise<void> {
    await this.eventBus.emit('execution.task.retrying', { runId, traceId, taskId, attempt, backoffMs })
    this.send(ws, { type: 'execution.task.retrying', payload: { runId, traceId, taskId, attempt, backoffMs } })
  }

  async emitTaskSkipped(ws: WS, runId: string, traceId: string, taskId: string, reason: string): Promise<void> {
    await this.eventBus.emit('execution.task.skipped', { runId, traceId, taskId, reason })
    this.send(ws, { type: 'execution.task.skipped', payload: { runId, traceId, taskId, reason } })
  }

  async emitApprovalRequired(ws: WS, request: ApprovalRequest): Promise<void> {
    const { id: requestId, runId, taskId, taskTitle, capability, approvalReason: reason } = request
    // Infer traceId via runId (passed through payload)
    await this.eventBus.emit('execution.approval.required', { runId, traceId: '', taskId, taskTitle, capability, reason, requestId })
    this.send(ws, { type: 'execution.approval.required', payload: { requestId, runId, taskId, taskTitle, capability, reason } })
  }

  async emitApprovalReceived(ws: WS, runId: string, traceId: string, taskId: string, approved: boolean): Promise<void> {
    await this.eventBus.emit('execution.approval.received', { runId, traceId, taskId, approved })
    this.send(ws, { type: 'execution.approval.received', payload: { runId, traceId, taskId, approved } })
  }

  async emitPaused(ws: WS, runId: string, traceId: string): Promise<void> {
    await this.eventBus.emit('execution.paused', { runId, traceId })
    this.send(ws, { type: 'execution.paused', payload: { runId, traceId } })
  }

  async emitResumed(ws: WS, runId: string, traceId: string): Promise<void> {
    await this.eventBus.emit('execution.resumed', { runId, traceId })
    this.send(ws, { type: 'execution.resumed', payload: { runId, traceId } })
  }

  async emitCompleted(ws: WS, result: ExecutionResult): Promise<void> {
    const { runId, traceId, tasksCompleted, tasksFailed, tasksSkipped, durationMs } = result
    await this.eventBus.emit('execution.completed', { runId, traceId, tasksCompleted, tasksFailed, tasksSkipped, durationMs })
    this.send(ws, { type: 'execution.completed', payload: { runId, traceId, tasksCompleted, tasksFailed, tasksSkipped, durationMs, report: result.report } })
  }

  async emitFailed(ws: WS, runId: string, traceId: string, errorCode: string, failedTaskId?: string, failureCategory?: string): Promise<void> {
    await this.eventBus.emit('execution.failed', { runId, traceId, errorCode, failedTaskId, failureCategory })
    this.send(ws, { type: 'execution.failed', payload: { runId, traceId, errorCode, failedTaskId, failureCategory } })
  }

  async emitCancelled(ws: WS, runId: string, traceId: string): Promise<void> {
    await this.eventBus.emit('execution.cancelled', { runId, traceId })
    this.send(ws, { type: 'execution.cancelled', payload: { runId, traceId } })
  }
}
