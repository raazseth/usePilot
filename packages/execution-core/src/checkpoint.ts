// CheckpointManager — snapshots execution state for restart resilience

import { generateId } from '@usepilot/utils'
import type { ExecutionCheckpoint, ExecutionStatus } from '@usepilot/execution-types'

export interface ICheckpointBackend {
  save(checkpoint: ExecutionCheckpoint): Promise<void>
  restore(runId: string): Promise<ExecutionCheckpoint | null>
  list(runId: string): Promise<ExecutionCheckpoint[]>
}

export class InMemoryCheckpointBackend implements ICheckpointBackend {
  private readonly store = new Map<string, ExecutionCheckpoint[]>()

  async save(checkpoint: ExecutionCheckpoint): Promise<void> {
    const existing = this.store.get(checkpoint.runId) ?? []
    existing.push(checkpoint)
    this.store.set(checkpoint.runId, existing)
  }

  async restore(runId: string): Promise<ExecutionCheckpoint | null> {
    const checkpoints = this.store.get(runId)
    if (!checkpoints || checkpoints.length === 0) return null
    return checkpoints[checkpoints.length - 1]!
  }

  async list(runId: string): Promise<ExecutionCheckpoint[]> {
    return this.store.get(runId) ?? []
  }
}

export class CheckpointManager {
  private count = 0

  constructor(
    private readonly runId: string,
    private readonly backend: ICheckpointBackend = new InMemoryCheckpointBackend()
  ) {}

  async save(state: {
    executionStatus: ExecutionStatus
    completedTaskIds: string[]
    pendingTaskIds: string[]
    failedTaskIds: string[]
    skippedTaskIds: string[]
    retryCounters: Record<string, number>
    pendingApprovalTaskId?: string
    metadata?: Record<string, unknown>
  }): Promise<ExecutionCheckpoint> {
    const checkpoint: ExecutionCheckpoint = {
      id: generateId(),
      runId: this.runId,
      createdAt: Date.now(),
      executionStatus: state.executionStatus,
      completedTaskIds: [...state.completedTaskIds],
      pendingTaskIds: [...state.pendingTaskIds],
      failedTaskIds: [...state.failedTaskIds],
      skippedTaskIds: [...state.skippedTaskIds],
      retryCounters: { ...state.retryCounters },
      pendingApprovalTaskId: state.pendingApprovalTaskId,
      metadata: state.metadata ?? {},
    }

    await this.backend.save(checkpoint)
    this.count++
    return checkpoint
  }

  async restore(): Promise<ExecutionCheckpoint | null> {
    return this.backend.restore(this.runId)
  }

  async list(): Promise<ExecutionCheckpoint[]> {
    return this.backend.list(this.runId)
  }

  getCount(): number {
    return this.count
  }
}
