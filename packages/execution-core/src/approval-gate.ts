// ApprovalGate — suspends execution on mandatory tasks, survives restart

import type { ApprovalRequest, ApprovalResponse } from '@usepilot/execution-types'
import type { Task } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'

interface PendingApproval {
  request: ApprovalRequest
  resolve: (response: ApprovalResponse) => void
  reject: (reason: Error) => void
  timeoutHandle: ReturnType<typeof setTimeout> | null
}

export class ApprovalGate {
  private readonly pending = new Map<string, PendingApproval>()
  private readonly defaultTimeoutMs: number

  constructor(options: { timeoutMs?: number } = {}) {
    this.defaultTimeoutMs = options.timeoutMs ?? 5 * 60 * 1000
  }

  async requestApproval(runId: string, traceId: string, task: Task): Promise<ApprovalResponse> {
    return new Promise<ApprovalResponse>((resolve, reject) => {
      const requestId = generateId()
      const requestedAt = Date.now()
      const expiresAt = requestedAt + this.defaultTimeoutMs

      const request: ApprovalRequest = {
        id: requestId,
        runId,
        taskId: task.id,
        taskTitle: task.title,
        capability: task.requiredCapability,
        approvalReason: task.approvalReason ?? `Task "${task.title}" requires manual approval`,
        policy: task.approvalPolicy,
        requestedAt,
        expiresAt,
      }

      const timeoutHandle = setTimeout(() => {
        this.pending.delete(task.id)
        reject(
          Object.assign(
            new Error(`Approval timeout for task "${task.title}" after ${this.defaultTimeoutMs}ms`),
            { code: 'APPROVAL_TIMEOUT', taskId: task.id }
          )
        )
      }, this.defaultTimeoutMs)

      this.pending.set(task.id, { request, resolve, reject, timeoutHandle })
    })
  }

  resolve(taskId: string, response: ApprovalResponse): boolean {
    const pending = this.pending.get(taskId)
    if (!pending) return false

    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle)
    }

    this.pending.delete(taskId)
    pending.resolve(response)
    return true
  }

  reject(taskId: string, reason: string): boolean {
    const pending = this.pending.get(taskId)
    if (!pending) return false

    if (pending.timeoutHandle) {
      clearTimeout(pending.timeoutHandle)
    }

    this.pending.delete(taskId)
    pending.reject(new Error(reason))
    return true
  }

  hasPending(taskId: string): boolean {
    return this.pending.has(taskId)
  }

  getPendingRequest(taskId: string): ApprovalRequest | undefined {
    return this.pending.get(taskId)?.request
  }

  getAllPending(): ApprovalRequest[] {
    return Array.from(this.pending.values()).map((p) => p.request)
  }

  clearAll(): void {
    for (const [, pending] of this.pending) {
      if (pending.timeoutHandle) clearTimeout(pending.timeoutHandle)
      pending.reject(new Error('ApprovalGate cleared'))
    }
    this.pending.clear()
  }
}
