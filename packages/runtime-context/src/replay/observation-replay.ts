import type { Observation, ObservationType } from '../observations/types'

export interface ReplayStateSnapshot {
  stepIndex: number
  totalSteps: number
  currentObservation?: Observation | undefined
  browser?: {
    currentUrl: string
    pageTitle: string
    domFingerprint: string
  } | undefined
  filesystem?: {
    lastPath: string
    exists: boolean
    sizeBytes: number
  } | undefined
  desktop?: {
    activeWindowTitle?: string | undefined
    focusedProcessId?: number | undefined
  } | undefined
  vision?: {
    imageHash: string
    detectedTextCount: number
  } | undefined
  verification?: {
    target: string
    satisfied: boolean
  } | undefined
}

export class ObservationReplayEngine {
  private observations: Observation[]
  private currentStep = 0

  constructor(observations: Observation[] = []) {
    // Sort strictly chronological
    this.observations = [...(observations ?? [])].sort((a, b) => a.timestamp - b.timestamp)
  }

  loadObservations(observations: Observation[]): void {
    this.observations = [...observations].sort((a, b) => a.timestamp - b.timestamp)
    this.currentStep = 0
  }

  getTotalSteps(): number {
    return this.observations.length
  }

  getCurrentStep(): number {
    return this.currentStep
  }

  seekTo(stepIndex: number): ReplayStateSnapshot | undefined {
    if (this.observations.length === 0) return undefined
    this.currentStep = Math.max(0, Math.min(stepIndex, this.observations.length - 1))
    return this.getCurrentSnapshot()
  }

  stepForward(): ReplayStateSnapshot | undefined {
    if (this.currentStep < this.observations.length - 1) {
      this.currentStep++
    }
    return this.getCurrentSnapshot()
  }

  stepBackward(): ReplayStateSnapshot | undefined {
    if (this.currentStep > 0) {
      this.currentStep--
    }
    return this.getCurrentSnapshot()
  }

  getCurrentSnapshot(): ReplayStateSnapshot {
    let latestBrowser: ReplayStateSnapshot['browser']
    let latestFilesystem: ReplayStateSnapshot['filesystem']
    let latestDesktop: ReplayStateSnapshot['desktop']
    let latestVision: ReplayStateSnapshot['vision']
    let latestVerification: ReplayStateSnapshot['verification']

    // Replay state up to currentStep
    for (let i = 0; i <= this.currentStep; i++) {
      const obs = this.observations[i]
      if (!obs) continue

      if (obs.type === 'browser_state') {
        latestBrowser = {
          currentUrl: obs.payload.currentUrl,
          pageTitle: obs.payload.pageTitle,
          domFingerprint: obs.payload.domFingerprint,
        }
      } else if (obs.type === 'filesystem_state') {
        latestFilesystem = {
          lastPath: obs.payload.targetPath,
          exists: obs.payload.exists,
          sizeBytes: obs.payload.sizeBytes,
        }
      } else if (obs.type === 'desktop_state') {
        latestDesktop = {
          activeWindowTitle: obs.payload.activeWindowTitle,
          focusedProcessId: obs.payload.focusedProcessId,
        }
      } else if (obs.type === 'vision_state') {
        latestVision = {
          imageHash: obs.payload.imageHash,
          detectedTextCount: obs.payload.detectedTexts.length,
        }
      } else if (obs.type === 'verification_state') {
        latestVerification = {
          target: obs.payload.target,
          satisfied: obs.payload.satisfied,
        }
      }
    }

    const currentObs = this.observations[this.currentStep]

    return {
      stepIndex: this.currentStep,
      totalSteps: this.observations.length,
      currentObservation: currentObs,
      browser: latestBrowser,
      filesystem: latestFilesystem,
      desktop: latestDesktop,
      vision: latestVision,
      verification: latestVerification,
    }
  }

  filterByType(type: ObservationType): Observation[] {
    return this.observations.filter((o) => o.type === type)
  }
}
