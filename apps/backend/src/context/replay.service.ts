import { ObservationReplayEngine } from '@usepilot/runtime-context'
import type { Observation, ReplayStateSnapshot } from '@usepilot/runtime-context'

export class ReplayService {
  private static instance: ReplayService | null = null
  private activeReplays = new Map<string, ObservationReplayEngine>()

  static getInstance(): ReplayService {
    if (!ReplayService.instance) {
      ReplayService.instance = new ReplayService()
    }
    return ReplayService.instance
  }

  createSession(runId: string, observations: Observation[]): ObservationReplayEngine {
    const replay = new ObservationReplayEngine(observations)
    this.activeReplays.set(runId, replay)
    return replay
  }

  getSession(runId: string): ObservationReplayEngine | undefined {
    return this.activeReplays.get(runId)
  }

  step(runId: string, direction: 'forward' | 'backward'): ReplayStateSnapshot | undefined {
    const replay = this.activeReplays.get(runId)
    if (!replay) return undefined
    return direction === 'forward' ? replay.stepForward() : replay.stepBackward()
  }
}
