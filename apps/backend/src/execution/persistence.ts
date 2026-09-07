// ExecutionPersistence — wraps all 7 execution repositories

import {
  ExecutionRunRepository,
  ExecutionTaskRecordRepository,
  ExecutionJournalRepository,
  ExecutionCheckpointRepository,
  ApprovalRequestRepository,
  ExecutionReportRepository,
  ExecutionManifestRepository,
} from '@usepilot/database'
import type { ExecutionReport, ExecutionManifest, ApprovalRequest, ApprovalResponse, ExecutionCheckpoint, JournalEntry } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

export class ExecutionPersistence {
  readonly runRepo: ExecutionRunRepository
  readonly taskRepo: ExecutionTaskRecordRepository
  readonly journalRepo: ExecutionJournalRepository
  readonly checkpointRepo: ExecutionCheckpointRepository
  readonly approvalRepo: ApprovalRequestRepository
  readonly reportRepo: ExecutionReportRepository
  readonly manifestRepo: ExecutionManifestRepository

  constructor(db: DB) {
    this.runRepo = new ExecutionRunRepository(db)
    this.taskRepo = new ExecutionTaskRecordRepository(db)
    this.journalRepo = new ExecutionJournalRepository(db)
    this.checkpointRepo = new ExecutionCheckpointRepository(db)
    this.approvalRepo = new ApprovalRequestRepository(db)
    this.reportRepo = new ExecutionReportRepository(db)
    this.manifestRepo = new ExecutionManifestRepository(db)
  }

  async createRun(data: { planId: string; blueprintHash: string; traceId: string; tasksTotal: number; contextSnapshot?: string }) {
    return this.runRepo.create(data)
  }

  async markRunCompleted(runId: string, tasksCompleted: number, tasksFailed: number, tasksSkipped: number) {
    await this.runRepo.markCompleted(runId, tasksCompleted, tasksFailed, tasksSkipped)
  }

  async markRunFailed(runId: string, errorCode: string) {
    await this.runRepo.markFailed(runId, errorCode)
  }

  async markRunCancelled(runId: string) {
    await this.runRepo.markCancelled(runId)
  }

  async appendJournal(entry: Omit<JournalEntry, 'id'>) {
    return this.journalRepo.append(entry)
  }

  async saveCheckpoint(checkpoint: Omit<ExecutionCheckpoint, 'id'>) {
    return this.checkpointRepo.save(checkpoint)
  }

  async restoreCheckpoint(runId: string): Promise<ExecutionCheckpoint | null> {
    return this.checkpointRepo.getLatest(runId)
  }

  async saveApproval(request: ApprovalRequest) {
    return this.approvalRepo.create(request)
  }

  async resolveApproval(requestId: string, response: ApprovalResponse) {
    return this.approvalRepo.resolve(requestId, response)
  }

  async saveReport(report: ExecutionReport) {
    return this.reportRepo.save(report)
  }

  async getReport(runId: string): Promise<ExecutionReport | null> {
    return this.reportRepo.findByRunId(runId)
  }

  async saveManifest(manifest: ExecutionManifest) {
    return this.manifestRepo.save(manifest)
  }

  async getManifest(runId: string): Promise<ExecutionManifest | null> {
    return this.manifestRepo.findByRunId(runId)
  }
}
