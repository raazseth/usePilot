import type { RuntimeContext } from '../../core/context'
import type { ObservationEngine, ObservationSubscriber } from '../../observations/observation-engine'
import type { Observation, ObservationFilter, ObservationType } from '../../observations/types'

export class ObservationsDomain {
  private observationEngine: ObservationEngine

  constructor(observationEngine: ObservationEngine) {
    this.observationEngine = observationEngine
  }

  emit(observation: Observation, targetContext?: RuntimeContext): void {
    this.observationEngine.emit(observation, targetContext)
  }

  query(filter?: ObservationFilter): Observation[] {
    return this.observationEngine.query(filter)
  }

  getLatest(type?: ObservationType): Observation | undefined {
    return this.observationEngine.getLatest(type)
  }

  purge(predicate: (obs: Observation) => boolean): number {
    return this.observationEngine.purge(predicate)
  }

  subscribe(subscriber: ObservationSubscriber): () => void {
    return this.observationEngine.subscribe(subscriber)
  }

  clear(): void {
    this.observationEngine.clear()
  }
}
