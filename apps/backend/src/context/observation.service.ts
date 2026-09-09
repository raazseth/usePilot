import { ObservationEngine } from '@usepilot/runtime-context'
import type { Observation, ObservationFilter } from '@usepilot/runtime-context'

export class ObservationService {
  private static instance: ObservationService | null = null
  private engine: ObservationEngine

  constructor(engine = ObservationEngine.getInstance()) {
    this.engine = engine
  }

  static getInstance(): ObservationService {
    if (!ObservationService.instance) {
      ObservationService.instance = new ObservationService()
    }
    return ObservationService.instance
  }

  getEngine(): ObservationEngine {
    return this.engine
  }

  recordObservation(observation: Observation): void {
    this.engine.emit(observation)
  }

  queryObservations(filter?: ObservationFilter): Observation[] {
    return this.engine.query(filter)
  }
}
