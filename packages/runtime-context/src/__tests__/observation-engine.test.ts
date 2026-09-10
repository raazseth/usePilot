import { describe, it, expect, vi } from 'vitest'

import { RuntimeContext } from '../core/context'
import { createProvenance } from '../core/provenance'
import { ObservationEngine } from '../observations/observation-engine'
import type { BrowserObservation, FilesystemObservation, DesktopObservation } from '../observations/types'

describe('Observation Engine & State Perception', () => {
  it('emits state observations and separates them from temporal events', () => {
    const engine = new ObservationEngine()
    const prov = createProvenance('browser', { confidence: 0.98 })

    const browserObs: BrowserObservation = {
      id: 'obs-1',
      type: 'browser_state',
      timestamp: 1000,
      source: 'browser',
      confidence: 0.98,
      provenance: prov,
      correlationId: 'corr-10',
      payload: {
        currentUrl: 'https://github.com/pulls',
        pageTitle: 'Pull Requests',
        domain: 'github.com',
        domFingerprint: 'dom-sha-abc',
        interactiveElements: [
          { selector: '#filter-btn', tag: 'button', text: 'Filters', isClickable: true },
        ],
        viewport: { width: 1280, height: 800 },
      },
    }

    engine.emit(browserObs)

    const queryResult = engine.query({ type: 'browser_state' })
    expect(queryResult.length).toBe(1)
    expect(queryResult[0]?.type).toBe('browser_state')
    expect(queryResult[0]?.confidence).toBe(0.98)
    expect((queryResult[0] as BrowserObservation).payload.currentUrl).toBe('https://github.com/pulls')
  })

  it('synchronizes observations directly with RuntimeContext', () => {
    const engine = new ObservationEngine()
    const ctx = new RuntimeContext('session-obs-test')

    const fsProv = createProvenance('filesystem')
    const fsObs: FilesystemObservation = {
      id: 'obs-fs-1',
      type: 'filesystem_state',
      timestamp: 2000,
      source: 'filesystem',
      confidence: 1.0,
      provenance: fsProv,
      payload: {
        targetPath: '/downloads/tax_report.pdf',
        exists: true,
        sizeBytes: 1048576,
        isWritable: true,
        isDirectory: false,
      },
    }

    engine.emit(fsObs, ctx)

    const state = ctx.getState()
    expect(state.filesystem.recentPaths).toContain('/downloads/tax_report.pdf')

    const desktopProv = createProvenance('desktop')
    const desktopObs: DesktopObservation = {
      id: 'obs-dt-1',
      type: 'desktop_state',
      timestamp: 2500,
      source: 'desktop',
      confidence: 0.9,
      provenance: desktopProv,
      payload: {
        activeWindowTitle: 'Figma - App Layout',
        focusedProcessId: 4412,
        clipboardPreview: 'Invoice summary 2026',
      },
    }

    engine.emit(desktopObs, ctx)

    const updatedState = ctx.getState()
    expect(updatedState.desktop.activeWindowTitle).toBe('Figma - App Layout')
    expect(updatedState.desktop.clipboardPreview).toBe('Invoice summary 2026')
  })

  it('notifies subscribers upon observation emission', () => {
    const engine = new ObservationEngine()
    const mockSubscriber = vi.fn()

    const unsubscribe = engine.subscribe(mockSubscriber)

    const obs: DesktopObservation = {
      id: 'obs-dt-2',
      type: 'desktop_state',
      timestamp: 3000,
      source: 'desktop',
      confidence: 1.0,
      provenance: createProvenance('desktop'),
      payload: {
        activeWindowTitle: 'Terminal',
      },
    }

    engine.emit(obs)
    expect(mockSubscriber).toHaveBeenCalledTimes(1)
    expect(mockSubscriber).toHaveBeenCalledWith(obs)

    unsubscribe()
    engine.emit(obs)
    expect(mockSubscriber).toHaveBeenCalledTimes(1)
  })
})
