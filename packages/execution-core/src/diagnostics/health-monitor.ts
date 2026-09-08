import type { HealthStatus, SystemHealthReport, SubsystemHealthState } from './health-types'
import { ResourceLeakDetector } from './leak-detector'

export class RuntimeHealthMonitor {
  private static instance: RuntimeHealthMonitor | null = null
  private startedAt = Date.now()
  private failureCounters = new Map<string, number>()
  private recoveryCounters = new Map<string, number>()
  private lastExecutionTimestamps = new Map<string, number>()
  private leakDetector: ResourceLeakDetector

  constructor(leakDetector?: ResourceLeakDetector) {
    this.leakDetector = leakDetector ?? ResourceLeakDetector.getInstance()
  }

  static getInstance(): RuntimeHealthMonitor {
    if (!RuntimeHealthMonitor.instance) {
      RuntimeHealthMonitor.instance = new RuntimeHealthMonitor()
    }
    return RuntimeHealthMonitor.instance
  }

  recordExecution(subsystem: string, success: boolean, recovered = false): void {
    this.lastExecutionTimestamps.set(subsystem, Date.now())
    if (!success) {
      this.failureCounters.set(subsystem, (this.failureCounters.get(subsystem) ?? 0) + 1)
    }
    if (recovered) {
      this.recoveryCounters.set(subsystem, (this.recoveryCounters.get(subsystem) ?? 0) + 1)
    }
  }

  getBrowserHealth(): HealthStatus {
    const failures = this.failureCounters.get('browser') ?? 0
    const recoveries = this.recoveryCounters.get('browser') ?? 0
    const activeContexts = this.leakDetector.getActiveCount('browser_context')
    const activePages = this.leakDetector.getActiveCount('browser_page')
    const activeSessions = this.leakDetector.getActiveCount('adapter_session')

    const status: SubsystemHealthState = failures > 5 ? 'degraded' : 'healthy'
    const memUsage = process.memoryUsage().heapUsed

    return {
      subsystem: 'browser',
      status,
      initialized: true,
      available: true,
      memoryUsageBytes: memUsage,
      activeSessions,
      failures,
      recoveries,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('browser'),
      details: {
        activeContexts,
        activePages,
      },
    }
  }

  getFilesystemHealth(): HealthStatus {
    const failures = this.failureCounters.get('filesystem') ?? 0
    return {
      subsystem: 'filesystem',
      status: failures > 3 ? 'degraded' : 'healthy',
      initialized: true,
      available: true,
      memoryUsageBytes: 1024 * 1024,
      activeSessions: 1,
      failures,
      recoveries: this.recoveryCounters.get('filesystem') ?? 0,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('filesystem'),
    }
  }

  getDesktopHealth(): HealthStatus {
    const failures = this.failureCounters.get('desktop') ?? 0
    return {
      subsystem: 'desktop',
      status: failures > 3 ? 'degraded' : 'healthy',
      initialized: true,
      available: process.platform === 'win32',
      memoryUsageBytes: 2 * 1024 * 1024,
      activeSessions: 1,
      failures,
      recoveries: this.recoveryCounters.get('desktop') ?? 0,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('desktop'),
      details: {
        platform: process.platform,
        arch: process.arch,
      },
    }
  }

  getVisionHealth(): HealthStatus {
    const failures = this.failureCounters.get('vision') ?? 0
    const activeWorkers = this.leakDetector.getActiveCount('ocr_worker')
    return {
      subsystem: 'vision',
      status: 'healthy',
      initialized: true,
      available: true,
      memoryUsageBytes: activeWorkers > 0 ? 64 * 1024 * 1024 : 0,
      activeSessions: activeWorkers,
      failures,
      recoveries: this.recoveryCounters.get('vision') ?? 0,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('vision'),
      details: { activeWorkers },
    }
  }

  getVaultHealth(): HealthStatus {
    return {
      subsystem: 'vault',
      status: 'healthy',
      initialized: true,
      available: true,
      memoryUsageBytes: 512 * 1024,
      activeSessions: 1,
      failures: this.failureCounters.get('vault') ?? 0,
      recoveries: 0,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('vault'),
      details: { cipher: 'AES-256-GCM' },
    }
  }

  getPermissionsHealth(): HealthStatus {
    return {
      subsystem: 'permissions',
      status: 'healthy',
      initialized: true,
      available: true,
      memoryUsageBytes: 256 * 1024,
      activeSessions: 1,
      failures: this.failureCounters.get('permissions') ?? 0,
      recoveries: 0,
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      lastExecution: this.lastExecutionTimestamps.get('permissions'),
    }
  }

  getSystemReport(): SystemHealthReport {
    const subsystems: Record<string, HealthStatus> = {
      browser: this.getBrowserHealth(),
      filesystem: this.getFilesystemHealth(),
      desktop: this.getDesktopHealth(),
      vision: this.getVisionHealth(),
      vault: this.getVaultHealth(),
      permissions: this.getPermissionsHealth(),
    }

    const leakWarnings = this.leakDetector.detectLeaks()

    let overall: SubsystemHealthState = 'healthy'
    for (const s of Object.values(subsystems)) {
      if (s.status === 'unhealthy') {
        overall = 'unhealthy'
        break
      }
      if (s.status === 'degraded') {
        overall = 'degraded'
      }
    }

    if (leakWarnings.some((w) => w.leakSeverity === 'high')) {
      overall = 'degraded'
    }

    return {
      overallStatus: overall,
      timestamp: Date.now(),
      subsystems,
      activeLeakWarnings: leakWarnings,
    }
  }
}
