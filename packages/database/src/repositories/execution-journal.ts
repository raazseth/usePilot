// ExecutionJournalRepository — append-only

import { eq, desc } from 'drizzle-orm'
import { generateId } from '@usepilot/utils'
import { executionJournal } from '../schema'
import type { ExecutionJournalRow, NewExecutionJournalRow } from '../schema'
import type { JournalEntry } from '@usepilot/execution-types'

type DB = ReturnType<typeof import('../client').createDatabase>

export class ExecutionJournalRepository {
  constructor(private readonly db: DB) {}

  async append(entry: Omit<JournalEntry, 'id'>): Promise<ExecutionJournalRow> {
    const row: NewExecutionJournalRow = {
      id: generateId(),
      runId: entry.runId,
      traceId: entry.traceId,
      taskId: entry.taskId,
      eventType: entry.eventType,
      adapterName: entry.adapterName,
      stateFrom: entry.stateFrom,
      stateTo: entry.stateTo,
      attemptNumber: entry.attemptNumber,
      payload: JSON.stringify(entry.payload),
      timestamp: entry.timestamp,
    }
    await this.db.insert(executionJournal).values(row)
    return row as ExecutionJournalRow
  }

  async getByRun(runId: string, limit = 500): Promise<ExecutionJournalRow[]> {
    return this.db
      .select()
      .from(executionJournal)
      .where(eq(executionJournal.runId, runId))
      .orderBy(executionJournal.timestamp)
      .limit(limit)
  }

  async getLatestByRun(runId: string, limit = 20): Promise<ExecutionJournalRow[]> {
    return this.db
      .select()
      .from(executionJournal)
      .where(eq(executionJournal.runId, runId))
      .orderBy(desc(executionJournal.timestamp))
      .limit(limit)
  }
}
