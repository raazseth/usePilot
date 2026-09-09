import type { RuntimeEntityGraph } from '../graph/entity-graph'
import type { RuntimeIndexEngine } from '../index/runtime-index'
import type { KnowledgeStore } from '../knowledge/knowledge-store'
import type { ExecutionMemoryStore } from '../memory/execution-memory'
import type { ObservationEngine } from '../observations/observation-engine'
import type {
  RuntimeContextHealthReport,
  SubsystemHealthReport,
  SubsystemHealthStatus,
} from './types'

export interface HealthMonitorDependencies {
  knowledgeStore: KnowledgeStore
  runtimeIndex: RuntimeIndexEngine
  observationEngine: ObservationEngine
  executionMemory: ExecutionMemoryStore
  entityGraph: RuntimeEntityGraph
}

export class RuntimeContextHealthMonitor {
  private deps: HealthMonitorDependencies

  constructor(deps: HealthMonitorDependencies) {
    this.deps = deps
  }

  getHealthReport(): RuntimeContextHealthReport {
    const now = Date.now()

    // 1. KnowledgeStore Health
    const ksCount = this.deps.knowledgeStore.getTotalCount()
    const ksReport: SubsystemHealthReport = {
      subsystem: 'KnowledgeStore',
      status: 'healthy',
      metrics: {
        totalItems: ksCount,
        categoryBreakdown: true,
      },
    }

    // 2. RuntimeIndex Health
    const indexCount = this.deps.runtimeIndex.count()
    const indexReport: SubsystemHealthReport = {
      subsystem: 'RuntimeIndex',
      status: 'healthy',
      metrics: {
        totalDocuments: indexCount,
        pdfCount: this.deps.runtimeIndex.count('pdf'),
        downloadCount: this.deps.runtimeIndex.count('download'),
        ocrCount: this.deps.runtimeIndex.count('ocr'),
      },
    }

    // 3. ObservationEngine Health
    const obsCount = this.deps.observationEngine.query().length
    const obsReport: SubsystemHealthReport = {
      subsystem: 'ObservationEngine',
      status: 'healthy',
      metrics: {
        recentObservations: obsCount,
        hasRecentPerceptions: obsCount > 0,
      },
    }

    // 4. BrowserGraph Health
    const browserGraph = this.deps.knowledgeStore.getBrowserGraph()
    const domains = browserGraph.listDomains()
    let staleDomains = 0
    for (const d of domains) {
      if (browserGraph.isStale(d)) staleDomains++
    }
    const bgStatus: SubsystemHealthStatus = staleDomains > 0 && staleDomains === domains.length ? 'degraded' : 'healthy'
    const bgReport: SubsystemHealthReport = {
      subsystem: 'BrowserGraph',
      status: bgStatus,
      metrics: {
        discoveredDomains: domains.length,
        staleDomains,
      },
    }

    // 5. ExecutionMemory Health
    const recentExecs = this.deps.executionMemory.listRecent(50)
    const successCount = recentExecs.filter((e) => e.success).length
    const successRate = recentExecs.length > 0 ? Math.round((successCount / recentExecs.length) * 100) : 100
    const emStatus: SubsystemHealthStatus = successRate < 50 ? 'degraded' : 'healthy'
    const emReport: SubsystemHealthReport = {
      subsystem: 'ExecutionMemory',
      status: emStatus,
      metrics: {
        recordedExecutions: recentExecs.length,
        successRatePercent: successRate,
      },
    }

    // 6. EntityGraph Health
    const graphCounts = this.deps.entityGraph.count()
    const egReport: SubsystemHealthReport = {
      subsystem: 'EntityGraph',
      status: 'healthy',
      metrics: {
        entitiesCount: graphCounts.entities,
        relationshipsCount: graphCounts.relationships,
      },
    }

    let overallStatus: SubsystemHealthStatus = 'healthy'
    if (bgReport.status === 'degraded' || emReport.status === 'degraded') {
      overallStatus = 'degraded'
    }

    return {
      overallStatus,
      timestamp: now,
      subsystems: {
        knowledgeStore: ksReport,
        runtimeIndex: indexReport,
        observationEngine: obsReport,
        browserGraph: bgReport,
        executionMemory: emReport,
        entityGraph: egReport,
      },
    }
  }
}
