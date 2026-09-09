import type { ContextProvenance, ProvenanceSource } from '../core/provenance'

export type ObservationType =
  | 'browser_state'
  | 'filesystem_state'
  | 'desktop_state'
  | 'vision_state'
  | 'verification_state'

export interface InteractiveElementDescriptor {
  selector: string
  tag: string
  text: string
  role?: string | undefined
  isClickable: boolean
}

export interface BaseObservation {
  id: string
  type: ObservationType
  timestamp: number
  source: ProvenanceSource
  confidence: number // 0.0 to 1.0
  provenance: ContextProvenance
  correlationId?: string | undefined
  metadata?: Record<string, unknown> | undefined
}

export interface BrowserObservation extends BaseObservation {
  type: 'browser_state'
  payload: {
    currentUrl: string
    pageTitle: string
    domain: string
    domFingerprint: string
    interactiveElements: InteractiveElementDescriptor[]
    viewport: { width: number; height: number }
  }
}

export interface FilesystemObservation extends BaseObservation {
  type: 'filesystem_state'
  payload: {
    targetPath: string
    exists: boolean
    sizeBytes: number
    mimeType?: string | undefined
    sha256Checksum?: string | undefined
    isWritable: boolean
    isDirectory: boolean
  }
}

export interface DesktopObservation extends BaseObservation {
  type: 'desktop_state'
  payload: {
    activeWindowTitle?: string | undefined
    focusedProcessId?: number | undefined
    focusedProcessName?: string | undefined
    clipboardHash?: string | undefined
    clipboardPreview?: string | undefined
  }
}

export interface VisionTextElement {
  text: string
  confidence: number
  bbox: [number, number, number, number] // [x, y, width, height]
}

export interface VisionObservation extends BaseObservation {
  type: 'vision_state'
  payload: {
    imageHash: string
    detectedTexts: VisionTextElement[]
    width: number
    height: number
  }
}

export interface VerificationObservation extends BaseObservation {
  type: 'verification_state'
  payload: {
    target: string
    assertionDescription: string
    observedValue: unknown
    expectedValue?: unknown | undefined
    satisfied: boolean
    strategyName: string
  }
}

export type Observation =
  | BrowserObservation
  | FilesystemObservation
  | DesktopObservation
  | VisionObservation
  | VerificationObservation

export interface ObservationFilter {
  type?: ObservationType | undefined
  source?: ProvenanceSource | undefined
  correlationId?: string | undefined
  fromTimestamp?: number | undefined
  toTimestamp?: number | undefined
  minConfidence?: number | undefined
  limit?: number | undefined
}
