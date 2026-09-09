export type SubsystemHealthStatus = 'healthy' | 'degraded' | 'unhealthy'

export interface SubsystemHealthReport {
  subsystem: string
  status: SubsystemHealthStatus
  metrics: Record<string, number | string | boolean>
}

export interface RuntimeContextHealthReport {
  overallStatus: SubsystemHealthStatus
  timestamp: number
  subsystems: {
    knowledgeStore: SubsystemHealthReport
    runtimeIndex: SubsystemHealthReport
    observationEngine: SubsystemHealthReport
    browserGraph: SubsystemHealthReport
    executionMemory: SubsystemHealthReport
    entityGraph: SubsystemHealthReport
  }
}
