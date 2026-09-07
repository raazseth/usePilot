// ExecutionReportRepository

import { eq } from 'drizzle-orm'
import { generateId, toTimestamp } from '@usepilot/utils'
import { executionReports } from '../schema'
import type { ExecutionReportRow } from '../schema'
import type { ExecutionReport } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionReportRepository {
  constructor(private readonly db: DB) {}

  async save(report: ExecutionReport): Promise<ExecutionReportRow> {
    const row = {
      id: generateId(),
      runId: report.runId,
      traceId: report.traceId,
      summary: report.summary,
      taskSummaries: JSON.stringify(report.taskSummaries),
      failureCategories: JSON.stringify(report.failureCategories),
      metrics: JSON.stringify(report.metrics),
      blueprintHash: report.blueprintHash ?? null,
      executionHash: report.executionHash ?? null,
      plannerVersion: report.plannerVersion ?? null,
      executionVersion: report.executionVersion ?? null,
      adapterVersions: report.adapterVersions ? JSON.stringify(report.adapterVersions) : null,
      contextSnapshot: report.contextSnapshot ? JSON.stringify(report.contextSnapshot) : null,
      createdAt: report.createdAt,
    }
    await this.db.insert(executionReports).values(row)
    return row as ExecutionReportRow
  }

  async findByRunId(runId: string): Promise<ExecutionReport | null> {
    const rows = await this.db
      .select()
      .from(executionReports)
      .where(eq(executionReports.runId, runId))

    const row = rows[0]
    if (!row) return null

    return {
      runId: row.runId,
      traceId: row.traceId,
      summary: row.summary,
      taskSummaries: JSON.parse(row.taskSummaries) as ExecutionReport['taskSummaries'],
      failureCategories: JSON.parse(row.failureCategories) as ExecutionReport['failureCategories'],
      metrics: JSON.parse(row.metrics) as ExecutionReport['metrics'],
      blueprintHash: row.blueprintHash ?? undefined,
      executionHash: row.executionHash ?? undefined,
      plannerVersion: row.plannerVersion ?? undefined,
      executionVersion: row.executionVersion ?? undefined,
      adapterVersions: row.adapterVersions ? (JSON.parse(row.adapterVersions) as Record<string, string>) : undefined,
      contextSnapshot: row.contextSnapshot ? (JSON.parse(row.contextSnapshot) as ExecutionReport['contextSnapshot']) : undefined,
      createdAt: row.createdAt,
    }
  }
}
