import type { Observation } from '../../observations/types'
import { ObservationReplayEngine, type ReplayStateSnapshot } from '../../replay/observation-replay'

export class ReplayDomain {
  private sessions = new Map<string, ObservationReplayEngine>()

  createSession(
    sessionId: string,
    observations: Observation[]
  ): ReplayStateSnapshot | undefined {
    const engine = new ObservationReplayEngine(observations)
    this.sessions.set(sessionId, engine)
    return engine.getCurrentSnapshot()
  }

  stepForward(sessionId: string): ReplayStateSnapshot | undefined {
    return this.sessions.get(sessionId)?.stepForward()
  }

  stepBackward(sessionId: string): ReplayStateSnapshot | undefined {
    return this.sessions.get(sessionId)?.stepBackward()
  }

  seekTo(sessionId: string, stepIndex: number): ReplayStateSnapshot | undefined {
    return this.sessions.get(sessionId)?.seekTo(stepIndex)
  }

  getSessionState(sessionId: string): ReplayStateSnapshot | undefined {
    return this.sessions.get(sessionId)?.getCurrentSnapshot()
  }

  closeSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }
}
