import type { RouteHandler } from '../router'
import { json } from '../router'
import { ObservationService, KnowledgeService, IndexService } from '../../../context'

export function contextRouter(): RouteHandler {
  const obsService = ObservationService.getInstance()
  const knowService = KnowledgeService.getInstance()
  const idxService = IndexService.getInstance()

  return async (req, url) => {
    if (req.method !== 'GET') return null

    if (url.pathname === '/context/summary') {
      const observations = obsService.queryObservations({ limit: 10 })
      const knowledge = knowService.getStore().listByCategory('persistent')
      const stats = {
        observationCount: observations.length,
        knowledgeCount: knowledge.length,
        status: 'operational',
        timestamp: Date.now(),
      }
      return json(stats)
    }

    if (url.pathname === '/context/observations') {
      const type = url.searchParams.get('type') as import('@usepilot/runtime-context').ObservationType | null
      const limit = Number(url.searchParams.get('limit') ?? '50')
      const observations = obsService.queryObservations({
        type: type ?? undefined,
        limit,
      })
      return json(observations)
    }

    if (url.pathname === '/context/search') {
      const query = url.searchParams.get('q') ?? ''
      const results = query ? idxService.search({ query, limit: 10 }) : []
      return json(results)
    }

    return null
  }
}
