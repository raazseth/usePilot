// ApprovalRequestRepository

import { eq } from 'drizzle-orm'
import { generateId, toTimestamp } from '@usepilot/utils'
import { approvalRequests } from '../schema'
import type { ApprovalRequestRow, NewApprovalRequestRow } from '../schema'
import type { ApprovalRequest, ApprovalResponse } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ApprovalRequestRepository {
  constructor(private readonly db: DB) {}

  async create(request: ApprovalRequest): Promise<ApprovalRequestRow> {
    const row: NewApprovalRequestRow = {
      id: request.id,
      runId: request.runId,
      taskId: request.taskId,
      taskTitle: request.taskTitle,
      capability: request.capability,
      approvalReason: request.approvalReason,
      policy: request.policy,
      requestedAt: request.requestedAt,
      expiresAt: request.expiresAt,
    }
    await this.db.insert(approvalRequests).values(row)
    return row as ApprovalRequestRow
  }

  async resolve(requestId: string, response: ApprovalResponse): Promise<void> {
    await this.db
      .update(approvalRequests)
      .set({
        respondedAt: response.respondedAt,
        approved: response.approved,
        comment: response.comment,
      })
      .where(eq(approvalRequests.id, requestId))
  }

  async findByRunId(runId: string): Promise<ApprovalRequestRow[]> {
    return this.db.select().from(approvalRequests).where(eq(approvalRequests.runId, runId))
  }

  async findPending(runId: string): Promise<ApprovalRequestRow[]> {
    const rows = await this.findByRunId(runId)
    return rows.filter((r) => r.respondedAt === null || r.respondedAt === undefined)
  }
}
