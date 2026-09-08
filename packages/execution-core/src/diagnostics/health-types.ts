// Runtime Diagnostics & Health Types

export type SubsystemHealthState = 'healthy' | 'degraded' | 'unhealthy'

export interface HealthStatus {
  subsystem: 'browser' | 'filesystem' | 'desktop' | 'vision' | 'vault' | 'permissions'
  status: SubsystemHealthState
  initialized: boolean
  available: boolean
  memoryUsageBytes: number
  activeSessions: number
  failures: number
  recoveries: number
  uptimeSeconds: number
  lastExecution?: number | undefined
  lastRestart?: number | undefined
  details?: Record<string, unknown> | undefined
}

export interface SystemHealthReport {
  overallStatus: SubsystemHealthState
  timestamp: number
  subsystems: Record<string, HealthStatus>
  activeLeakWarnings: ResourceLeakWarning[]
}

export type TrackedResourceType =
  | 'browser_context'
  | 'browser_page'
  | 'file_handle'
  | 'adapter_session'
  | 'ocr_worker'

export interface ResourceLeakWarning {
  resourceType: TrackedResourceType
  resourceId: string
  allocatedAt: number
  allocatedBy: string
  ageSeconds: number
  leakSeverity: 'low' | 'medium' | 'high'
}
