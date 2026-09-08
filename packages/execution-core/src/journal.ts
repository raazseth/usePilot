// ExecutionJournal — append-only audit trail

import type { JournalEntry, JournalEventType } from '@usepilot/execution-types'
import { generateId } from '@usepilot/utils'

type JournalEntryInput = Omit<JournalEntry, 'id' | 'timestamp'>

export interface IJournalBackend {
  append(entry: JournalEntry): Promise<void>
  getByRun(runId: string): Promise<JournalEntry[]>
}

export class InMemoryJournalBackend implements IJournalBackend {
  private readonly entries: JournalEntry[] = []

  async append(entry: JournalEntry): Promise<void> {
    this.entries.push(entry)
  }

  async getByRun(runId: string): Promise<JournalEntry[]> {
    return this.entries.filter((e) => e.runId === runId)
  }
}

export class ExecutionJournal {
  private count = 0

  constructor(private readonly backend: IJournalBackend = new InMemoryJournalBackend()) {}

  async append(input: JournalEntryInput): Promise<JournalEntry> {
    const entry: JournalEntry = {
      id: generateId(),
      timestamp: Date.now(),
      ...input,
    }
    await this.backend.append(entry)
    this.count++
    return entry
  }

  async getByRun(runId: string): Promise<JournalEntry[]> {
    return this.backend.getByRun(runId)
  }

  getCount(): number {
    return this.count
  }

  async log(
    runId: string,
    traceId: string,
    eventType: JournalEventType,
    payload: Record<string, unknown>,
    opts?: Partial<Pick<JournalEntry, 'taskId' | 'adapterName' | 'stateFrom' | 'stateTo' | 'attemptNumber'>>
  ): Promise<void> {
    await this.append({ runId, traceId, eventType, payload, ...opts })
  }
}
