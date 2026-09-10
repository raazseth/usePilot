import { describe, it, expect } from 'vitest'

import { RuntimeHealthMonitor } from '../diagnostics/health-monitor'
import { ResourceLeakDetector } from '../diagnostics/leak-detector'

describe('Runtime Health Monitoring & Resource Leak Detection', () => {
  it('ResourceLeakDetector tracks resource allocations and cleans up leaks', async () => {
    const leakDetector = new ResourceLeakDetector()
    let disposalCalled = false

    leakDetector.track('ctx-1', 'browser_context', 'browser-adapter', () => {
      disposalCalled = true
    })
    leakDetector.track('page-1', 'browser_page', 'browser-adapter')
    leakDetector.track('worker-1', 'ocr_worker', 'vision-subsystem')

    expect(leakDetector.getActiveCount()).toBe(3)
    expect(leakDetector.getActiveCount('browser_context')).toBe(1)
    expect(leakDetector.getActiveCount('browser_page')).toBe(1)
    expect(leakDetector.getActiveCount('ocr_worker')).toBe(1)

    // Check leak detection with zero maxAge
    const leaks = leakDetector.detectLeaks(0)
    expect(leaks.length).toBe(3)
    expect(leaks[0]?.resourceType).toBeDefined()

    // Clean up
    const cleaned = await leakDetector.cleanupAllLeakedResources()
    expect(cleaned).toBe(1)
    expect(disposalCalled).toBe(true)
    expect(leakDetector.getActiveCount()).toBe(0)
  })

  it('RuntimeHealthMonitor evaluates subsystem health accurately', () => {
    const leakDetector = new ResourceLeakDetector()
    const monitor = new RuntimeHealthMonitor(leakDetector)

    // Record some mock executions
    monitor.recordExecution('browser', true)
    monitor.recordExecution('filesystem', true)
    monitor.recordExecution('desktop', true)
    monitor.recordExecution('vision', true)

    const browserHealth = monitor.getBrowserHealth()
    expect(browserHealth.status).toBe('healthy')
    expect(browserHealth.subsystem).toBe('browser')
    expect(browserHealth.initialized).toBe(true)
    expect(browserHealth.available).toBe(true)

    const fsHealth = monitor.getFilesystemHealth()
    expect(fsHealth.status).toBe('healthy')
    expect(fsHealth.subsystem).toBe('filesystem')

    const desktopHealth = monitor.getDesktopHealth()
    expect(desktopHealth.subsystem).toBe('desktop')

    const vaultHealth = monitor.getVaultHealth()
    expect(vaultHealth.status).toBe('healthy')
    expect(vaultHealth.details?.['cipher']).toBe('AES-256-GCM')

    const systemReport = monitor.getSystemReport()
    expect(systemReport.overallStatus).toBe('healthy')
    expect(systemReport.subsystems['browser']).toBeDefined()
    expect(systemReport.subsystems['filesystem']).toBeDefined()
    expect(systemReport.subsystems['desktop']).toBeDefined()
    expect(systemReport.subsystems['vision']).toBeDefined()
    expect(systemReport.subsystems['vault']).toBeDefined()
    expect(systemReport.subsystems['permissions']).toBeDefined()
  })

  it('flags degraded subsystem status upon repeated execution failures', () => {
    const leakDetector = new ResourceLeakDetector()
    const monitor = new RuntimeHealthMonitor(leakDetector)

    for (let i = 0; i < 6; i++) {
      monitor.recordExecution('browser', false)
    }

    const browserHealth = monitor.getBrowserHealth()
    expect(browserHealth.status).toBe('degraded')
    expect(browserHealth.failures).toBe(6)

    const report = monitor.getSystemReport()
    expect(report.overallStatus).toBe('degraded')
  })
})
