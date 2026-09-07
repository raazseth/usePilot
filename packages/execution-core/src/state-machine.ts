// ExecutionStateMachine — enforces valid state transitions

import type { ExecutionStatus, TaskExecutionStatus } from '@usepilot/execution-types'

const EXECUTION_TRANSITIONS: Record<ExecutionStatus, ExecutionStatus[]> = {
  created:          ['running', 'cancelled'],
  running:          ['paused', 'waiting_approval', 'completed', 'failed', 'cancelled'],
  paused:           ['running', 'cancelled'],
  waiting_approval: ['running', 'failed', 'cancelled'],
  recovering:       ['running', 'failed', 'cancelled'],
  completed:        [],
  failed:           [],
  cancelled:        [],
}

const TASK_TRANSITIONS: Record<TaskExecutionStatus, TaskExecutionStatus[]> = {
  pending:          ['ready', 'running', 'waiting_approval', 'skipped', 'cancelled'],
  ready:            ['running', 'waiting_approval', 'skipped', 'cancelled'],
  running:          ['waiting_approval', 'verifying', 'completed', 'failed', 'cancelled', 'retrying', 'skipped'],
  waiting_approval: ['ready', 'running', 'failed', 'cancelled'],
  verifying:        ['completed', 'failed', 'retrying'],
  retrying:         ['running', 'failed', 'cancelled'],
  completed:        [],
  failed:           [],
  skipped:          [],
  cancelled:        [],
}

export class ExecutionStateMachine {
  private executionStatus: ExecutionStatus = 'created'
  private taskStatuses = new Map<string, TaskExecutionStatus>()

  getExecutionStatus(): ExecutionStatus {
    return this.executionStatus
  }

  getTaskStatus(taskId: string): TaskExecutionStatus {
    return this.taskStatuses.get(taskId) ?? 'pending'
  }

  transitionExecution(to: ExecutionStatus): { from: ExecutionStatus; to: ExecutionStatus } {
    const from = this.executionStatus
    const allowed = EXECUTION_TRANSITIONS[from]

    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid execution transition: "${from}" → "${to}". Allowed: [${allowed.join(', ')}]`
      )
    }

    this.executionStatus = to
    return { from, to }
  }

  transitionTask(
    taskId: string,
    to: TaskExecutionStatus
  ): { taskId: string; from: TaskExecutionStatus; to: TaskExecutionStatus } {
    const from = this.taskStatuses.get(taskId) ?? 'pending'
    const allowed = TASK_TRANSITIONS[from]

    if (!allowed.includes(to)) {
      throw new Error(
        `Invalid task transition for "${taskId}": "${from}" → "${to}". Allowed: [${allowed.join(', ')}]`
      )
    }

    this.taskStatuses.set(taskId, to)
    return { taskId, from, to }
  }

  initializeTask(taskId: string): void {
    if (!this.taskStatuses.has(taskId)) {
      this.taskStatuses.set(taskId, 'pending')
    }
  }

  getAllTaskStatuses(): Map<string, TaskExecutionStatus> {
    return new Map(this.taskStatuses)
  }

  isTerminal(): boolean {
    return ['completed', 'failed', 'cancelled'].includes(this.executionStatus)
  }
}
