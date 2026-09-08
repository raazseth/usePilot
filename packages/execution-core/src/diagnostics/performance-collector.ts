export interface TaskPerformanceRecord {
  taskId: string
  capability: string
  adapterId: string
  durationMs: number
  verificationDurationMs: number
  retries: number
  healingAttempts: number
  approvalWaitMs: number
  artifactsCount: number
}

export interface ExecutionPerformanceSummary {
  executionId: string
  totalDurationMs: number
  taskCount: number
  retriesTotal: number
  healingTotal: number
  verificationDurationMsTotal: number
  approvalWaitMsTotal: number
  memoryPeakBytes: number
  cpuTimeMs: number
  artifactsProducedTotal: number
  tasks: TaskPerformanceRecord[]
  capabilityBreakdown: Record<string, { count: number; avgDurationMs: number }>
  adapterBreakdown: Record<string, { count: number; avgDurationMs: number }>
}

export class PerformanceMetricsCollector {
  private executionId: string
  private startedAt = Date.now()
  private taskRecords: TaskPerformanceRecord[] = []
  private memoryPeak = process.memoryUsage().heapUsed
  private startCpuUsage = process.cpuUsage()

  constructor(executionId: string) {
    this.executionId = executionId
  }

  recordTask(record: TaskPerformanceRecord): void {
    this.taskRecords.push(record)
    const currentMem = process.memoryUsage().heapUsed
    if (currentMem > this.memoryPeak) {
      this.memoryPeak = currentMem
    }
  }

  finish(): ExecutionPerformanceSummary {
    const totalDurationMs = Date.now() - this.startedAt
    const cpuDiff = process.cpuUsage(this.startCpuUsage)
    const cpuTimeMs = Math.round((cpuDiff.user + cpuDiff.system) / 1000)

    let retriesTotal = 0
    let healingTotal = 0
    let verificationDurationMsTotal = 0
    let approvalWaitMsTotal = 0
    let artifactsProducedTotal = 0

    const capTotals: Record<string, { count: number; totalDuration: number }> = {}
    const adapterTotals: Record<string, { count: number; totalDuration: number }> = {}

    for (const t of this.taskRecords) {
      retriesTotal += t.retries
      healingTotal += t.healingAttempts
      verificationDurationMsTotal += t.verificationDurationMs
      approvalWaitMsTotal += t.approvalWaitMs
      artifactsProducedTotal += t.artifactsCount

      const capData = capTotals[t.capability] ?? { count: 0, totalDuration: 0 }
      capData.count++
      capData.totalDuration += t.durationMs
      capTotals[t.capability] = capData

      const adapterData = adapterTotals[t.adapterId] ?? { count: 0, totalDuration: 0 }
      adapterData.count++
      adapterData.totalDuration += t.durationMs
      adapterTotals[t.adapterId] = adapterData
    }

    const capabilityBreakdown: Record<string, { count: number; avgDurationMs: number }> = {}
    for (const [cap, data] of Object.entries(capTotals)) {
      capabilityBreakdown[cap] = {
        count: data.count,
        avgDurationMs: Math.round(data.totalDuration / data.count),
      }
    }

    const adapterBreakdown: Record<string, { count: number; avgDurationMs: number }> = {}
    for (const [ad, data] of Object.entries(adapterTotals)) {
      adapterBreakdown[ad] = {
        count: data.count,
        avgDurationMs: Math.round(data.totalDuration / data.count),
      }
    }

    return {
      executionId: this.executionId,
      totalDurationMs,
      taskCount: this.taskRecords.length,
      retriesTotal,
      healingTotal,
      verificationDurationMsTotal,
      approvalWaitMsTotal,
      memoryPeakBytes: this.memoryPeak,
      cpuTimeMs,
      artifactsProducedTotal,
      tasks: [...this.taskRecords],
      capabilityBreakdown,
      adapterBreakdown,
    }
  }
}
