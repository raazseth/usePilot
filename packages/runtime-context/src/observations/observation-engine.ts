import type { RuntimeContext } from '../core/context'
import type {
  Observation,
  ObservationType,
  ObservationFilter,
} from './types'

export type ObservationSubscriber = (observation: Observation) => void

export class ObservationEngine {
  private static instance: ObservationEngine | null = null
  private observations: Observation[] = []
  private subscribers = new Set<ObservationSubscriber>()
  private maxStoredObservations: number

  constructor(maxStoredObservations = 2000) {
    this.maxStoredObservations = maxStoredObservations
  }

  static getInstance(): ObservationEngine {
    if (!ObservationEngine.instance) {
      ObservationEngine.instance = new ObservationEngine()
    }
    return ObservationEngine.instance
  }

  emit(observation: Observation, targetContext?: RuntimeContext): void {
    // 1. Store observation bounded by max limit
    this.observations.push(observation)
    if (this.observations.length > this.maxStoredObservations) {
      this.observations.shift()
    }

    // 2. Reflect state into RuntimeContext if provided
    if (targetContext) {
      this.synchronizeWithContext(observation, targetContext)
    }

    // 3. Notify subscribers
    for (const subscriber of this.subscribers) {
      try {
        subscriber(observation)
      } catch (err) {
        console.error('[ObservationEngine] Subscriber error:', err)
      }
    }
  }

  private synchronizeWithContext(observation: Observation, context: RuntimeContext): void {
    switch (observation.type) {
      case 'browser_state':
        context.setBrowserState(
          {
            currentUrl: observation.payload.currentUrl,
            pageTitle: observation.payload.pageTitle,
            activeDomain: observation.payload.domain,
          },
          observation.provenance
        )
        break
      case 'desktop_state':
        context.setDesktopState(
          {
            activeWindowTitle: observation.payload.activeWindowTitle,
            focusedProcessId: observation.payload.focusedProcessId,
            clipboardPreview: observation.payload.clipboardPreview,
          },
          observation.provenance
        )
        break
      case 'filesystem_state':
        context.setFilesystemState(
          {
            recentPaths: [
              observation.payload.targetPath,
              ...context.getState().filesystem.recentPaths.filter((p) => p !== observation.payload.targetPath),
            ].slice(0, 10),
          },
          observation.provenance
        )
        break
      case 'vision_state':
      case 'verification_state':
        context.setCustomEntry(`obs:${observation.id}`, observation.payload, observation.provenance)
        break
    }
  }

  query(filter: ObservationFilter = {}): Observation[] {
    let result = [...this.observations]

    if (filter.type) {
      result = result.filter((o) => o.type === filter.type)
    }
    if (filter.source) {
      result = result.filter((o) => o.source === filter.source)
    }
    if (filter.correlationId) {
      result = result.filter((o) => o.correlationId === filter.correlationId)
    }
    if (typeof filter.minConfidence === 'number') {
      const min = filter.minConfidence
      result = result.filter((o) => o.confidence >= min)
    }
    if (typeof filter.fromTimestamp === 'number') {
      const from = filter.fromTimestamp
      result = result.filter((o) => o.timestamp >= from)
    }
    if (typeof filter.toTimestamp === 'number') {
      const to = filter.toTimestamp
      result = result.filter((o) => o.timestamp <= to)
    }

    // Default chronological
    result.sort((a, b) => a.timestamp - b.timestamp)

    if (filter.limit && filter.limit > 0) {
      result = result.slice(-filter.limit)
    }

    return result
  }

  getLatest(type?: ObservationType): Observation | undefined {
    if (!type) return this.observations[this.observations.length - 1]
    for (let i = this.observations.length - 1; i >= 0; i--) {
      const obs = this.observations[i]
      if (obs && obs.type === type) return obs
    }
    return undefined
  }

  subscribe(subscriber: ObservationSubscriber): () => void {
    this.subscribers.add(subscriber)
    return () => {
      this.subscribers.delete(subscriber)
    }
  }

  purge(predicate: (obs: Observation) => boolean): number {
    const before = this.observations.length
    this.observations = this.observations.filter((obs) => !predicate(obs))
    return before - this.observations.length
  }

  clear(): void {
    this.observations = []
  }
}
