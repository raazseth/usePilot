import type { JournalEntry, ExecutionReport } from '@usepilot/execution-types'

import type { ArtifactManager } from '../artifacts/artifact-manager'
import type { ArtifactMetadata } from '../artifacts/types'
import { DiagnosticTimelineBuilder } from '../diagnostics/diagnostic-timeline'
import type { TimelineEvent } from '../diagnostics/diagnostic-timeline'

export interface ReplayFrame {
  stepIndex: number
  event: TimelineEvent
  screenshotUri?: string | undefined
  domSnapshotUri?: string | undefined
  associatedArtifacts: ArtifactMetadata[]
  activeTaskTitle?: string | undefined
}

export class ExecutionReplayEngine {
  private executionId: string
  private timeline: TimelineEvent[] = []
  private artifacts: ArtifactMetadata[] = []
  private frames: ReplayFrame[] = []
  private report?: ExecutionReport | undefined

  constructor(
    executionId: string,
    journalEntries: JournalEntry[],
    artifacts: ArtifactMetadata[],
    report?: ExecutionReport
  ) {
    this.executionId = executionId
    this.artifacts = artifacts
    this.report = report

    const builder = new DiagnosticTimelineBuilder()
    this.timeline = builder.fromJournalAndArtifacts(executionId, journalEntries, artifacts)
    this.buildFrames()
  }

  static async fromArtifactManager(
    executionId: string,
    artifactManager: ArtifactManager,
    journalEntries: JournalEntry[],
    report?: ExecutionReport
  ): Promise<ExecutionReplayEngine> {
    const artifacts = await artifactManager.getExecutionArtifacts(executionId)
    return new ExecutionReplayEngine(executionId, journalEntries, artifacts, report)
  }

  private buildFrames(): void {
    let latestScreenshotUri: string | undefined
    let latestDomUri: string | undefined

    this.frames = this.timeline.map((event, index) => {
      if (event.type === 'screenshot' && event.artifactUri) {
        latestScreenshotUri = event.artifactUri
      }
      if (event.artifactUri?.includes('/dom/') || event.artifactUri?.endsWith('.html')) {
        latestDomUri = event.artifactUri
      }

      const associated = this.artifacts.filter(
        (a) => (event.taskId && a.taskId === event.taskId) || a.uri === event.artifactUri
      )

      return {
        stepIndex: index,
        event,
        screenshotUri: latestScreenshotUri,
        domSnapshotUri: latestDomUri,
        associatedArtifacts: associated,
        activeTaskTitle: event.taskId ? `Task ${event.taskId}` : undefined,
      }
    })
  }

  getTotalSteps(): number {
    return this.frames.length
  }

  getFrame(stepIndex: number): ReplayFrame | undefined {
    return this.frames[stepIndex]
  }

  getAllFrames(): ReplayFrame[] {
    return [...this.frames]
  }

  getTimeline(): TimelineEvent[] {
    return [...this.timeline]
  }

  getReport(): ExecutionReport | undefined {
    return this.report
  }

  getExecutionId(): string {
    return this.executionId
  }
}
