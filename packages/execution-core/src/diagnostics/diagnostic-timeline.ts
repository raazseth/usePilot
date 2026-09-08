import type { JournalEntry } from '@usepilot/execution-types'

import type { ArtifactMetadata } from '../artifacts/types'

export type TimelineEventType =
  | 'execution_start'
  | 'planner_reference'
  | 'adapter_selected'
  | 'session_reused'
  | 'task_start'
  | 'task_complete'
  | 'task_failed'
  | 'verification'
  | 'retry'
  | 'self_healing'
  | 'approval_requested'
  | 'approval_granted'
  | 'download'
  | 'upload'
  | 'screenshot'
  | 'artifact_created'
  | 'execution_complete'

export interface TimelineEvent {
  id: string
  timestamp: number
  type: TimelineEventType
  executionId: string
  taskId?: string | undefined
  capability?: string | undefined
  adapterId?: string | undefined
  title: string
  description?: string | undefined
  durationMs?: number | undefined
  status?: 'success' | 'failed' | 'warning' | 'info' | undefined
  artifactUri?: string | undefined
  metadata?: Record<string, unknown> | undefined
}

export class DiagnosticTimelineBuilder {
  private events: TimelineEvent[] = []

  addEvent(event: Omit<TimelineEvent, 'id'>): TimelineEvent {
    const fullEvent: TimelineEvent = {
      ...event,
      id: `evt-${event.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    }
    this.events.push(fullEvent)
    return fullEvent
  }

  fromJournalAndArtifacts(
    executionId: string,
    journalEntries: JournalEntry[],
    artifacts: ArtifactMetadata[]
  ): TimelineEvent[] {
    const events: TimelineEvent[] = []

    // 1. Convert journal entries
    for (const j of journalEntries) {
      let type: TimelineEventType = 'task_start'
      let status: TimelineEvent['status'] = 'info'

      if (j.eventType === 'execution_started') {
        type = 'execution_start'
        status = 'info'
      } else if (j.eventType === 'execution_completed') {
        type = 'execution_complete'
        status = 'success'
      } else if (j.eventType === 'execution_failed') {
        type = 'execution_complete'
        status = 'failed'
      } else if (j.eventType === 'task_completed') {
        type = 'task_complete'
        status = 'success'
      } else if (j.eventType === 'task_failed') {
        type = 'task_failed'
        status = 'failed'
      } else if (j.eventType === 'verification_result') {
        type = 'verification'
        status = j.payload['passed'] === true ? 'success' : 'failed'
      } else if (j.eventType === 'task_retrying') {
        type = 'self_healing'
        status = 'warning'
      } else if (j.eventType === 'approval_requested') {
        type = 'approval_requested'
        status = 'warning'
      } else if (j.eventType === 'approval_received') {
        type = 'approval_granted'
        status = 'success'
      }

      events.push({
        id: `evt-${j.timestamp}-${j.id}`,
        timestamp: j.timestamp,
        type,
        executionId,
        taskId: j.taskId,
        title: j.eventType.replace(/_/g, ' ').toUpperCase(),
        description: j.payload ? JSON.stringify(j.payload) : undefined,
        status,
        metadata: j.payload,
      })
    }

    // 2. Cross-link artifact creation events
    for (const art of artifacts) {
      let type: TimelineEventType = 'artifact_created'
      if (art.type === 'screenshot') type = 'screenshot'
      else if (art.type === 'download') type = 'download'
      else if (art.type === 'upload') type = 'upload'

      events.push({
        id: `evt-${art.createdAt}-${art.id}`,
        timestamp: art.createdAt,
        type,
        executionId: art.executionId,
        taskId: art.taskId,
        capability: art.capability,
        title: `Artifact: ${art.type.toUpperCase()}`,
        description: `${art.uri} (${Math.round(art.size / 1024)} KB)`,
        status: 'info',
        artifactUri: art.uri,
        metadata: {
          mimeType: art.mimeType,
          checksum: art.checksum,
          size: art.size,
          tags: art.tags,
        },
      })
    }

    // Sort chronologically
    return events.sort((a, b) => a.timestamp - b.timestamp)
  }

  getEvents(): TimelineEvent[] {
    return [...this.events].sort((a, b) => a.timestamp - b.timestamp)
  }
}
