import { describe, it, expect } from 'vitest'
import {
  CAPABILITY_DEPENDENCY_GRAPH,
  DEFAULT_RUNTIME_FEATURE_FLAGS,
  type JournalEntry,
  type AdapterManifest,
} from '@usepilot/execution-types'
import { ExecutionTimelineBuilder } from '../timeline'
import { CapabilityRegistry } from '../registry'

describe('Pre-Phase 6 Architecture Extensions', () => {
  it('builds an index-based ExecutionTimeline referencing entities without data duplication', () => {
    const mockJournal: JournalEntry[] = [
      {
        id: 'j-1',
        runId: 'r-1',
        traceId: 'tr-1',
        taskId: 't-1',
        eventType: 'task_started',
        timestamp: 1000,
        payload: { taskTitle: 'Open Browser' },
      },
      {
        id: 'j-2',
        runId: 'r-1',
        traceId: 'tr-1',
        taskId: 't-1',
        eventType: 'task_completed',
        timestamp: 1500,
        payload: { durationMs: 500 },
      },
      {
        id: 'j-3',
        runId: 'r-1',
        traceId: 'tr-1',
        taskId: 't-1',
        eventType: 'verification_result',
        timestamp: 1600,
        payload: { passed: true, verificationId: 'v-101' },
      },
    ]

    const timeline = ExecutionTimelineBuilder.fromJournal('r-1', 'tr-1', mockJournal, 1650)
    expect(timeline.runId).toBe('r-1')
    expect(timeline.traceId).toBe('tr-1')
    expect(timeline.entries).toHaveLength(3)
    // Validates reference indexing
    expect(timeline.entries[0]!.type).toBe('task_started')
    expect(timeline.entries[0]!.journalEntryId).toBe('j-1')
    expect(timeline.entries[0]!.taskId).toBe('t-1')
    expect(timeline.entries[1]!.type).toBe('task_completed')
    expect(timeline.entries[1]!.journalEntryId).toBe('j-2')
    expect(timeline.entries[2]!.type).toBe('verification')
    expect(timeline.entries[2]!.journalEntryId).toBe('j-3')
    expect(timeline.entries[2]!.verificationId).toBe('v-101')
  })

  it('exposes typed dependency graph relationships (required, optional, fallback)', () => {
    const downloadReq = CAPABILITY_DEPENDENCY_GRAPH['download_file']
    expect(downloadReq).toBeDefined()
    expect(downloadReq.subsystems.find((s) => s.subsystem === 'browser')?.type).toBe('required')
    expect(downloadReq.subsystems.find((s) => s.subsystem === 'filesystem')?.type).toBe('required')

    const searchReq = CAPABILITY_DEPENDENCY_GRAPH['search_web']
    expect(searchReq).toBeDefined()
    expect(searchReq.subsystems.find((s) => s.subsystem === 'browser')?.type).toBe('required')
    expect(searchReq.subsystems.find((s) => s.subsystem === 'desktop')?.type).toBe('fallback')

    const navReq = CAPABILITY_DEPENDENCY_GRAPH['navigate_website']
    expect(navReq.subsystems.find((s) => s.subsystem === 'vision')?.type).toBe('optional')
  })

  it('provides default runtime feature flags', () => {
    expect(DEFAULT_RUNTIME_FEATURE_FLAGS.browserEnabled).toBe(true)
    expect(DEFAULT_RUNTIME_FEATURE_FLAGS.desktopEnabled).toBe(true)
    expect(DEFAULT_RUNTIME_FEATURE_FLAGS.visionEnabled).toBe(true)
    expect(DEFAULT_RUNTIME_FEATURE_FLAGS.experimental).toBe(false)
  })

  it('validates immutable adapter manifest structure with apiVersion and runtimeVersion', () => {
    const manifest: Readonly<AdapterManifest> = {
      name: 'PlaywrightBrowserAdapter',
      version: '1.0.0',
      apiVersion: '0.1.0',
      runtimeVersion: '0.3.0',
      platform: ['windows', 'macos', 'linux'],
      permissions: ['browser', 'network'],
      capabilities: ['navigate_website', 'extract_web_data'],
      featureFlags: ['headless', 'tracing'],
      hash: 'manifest-hash-123',
    }
    expect(manifest.name).toBe('PlaywrightBrowserAdapter')
    expect(manifest.apiVersion).toBe('0.1.0')
    expect(manifest.runtimeVersion).toBe('0.3.0')
    expect(manifest.capabilities).toHaveLength(2)
  })

  it('exposes minimal capability registry health summary', () => {
    const registry = new CapabilityRegistry()
    const health = registry.getHealth('windows')
    expect(health.adaptersRegistered).toBe(0)
    expect(health.adaptersAvailable).toBe(0)
    expect(Array.isArray(health.capabilitiesCovered)).toBe(true)
  })
})
