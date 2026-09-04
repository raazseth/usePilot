// Request Classifier Types

/**
 * All top-level request routing categories.
 * 'conversation' — handled by Phase 1 chat (unchanged)
 * 'planning'     — handed to the Phase 2 planner pipeline
 * 'execution'    — reserved for Phase 3 execution engine
 * 'unknown'      — classifier confidence too low; fall back to conversation
 */
export type RequestType = 'conversation' | 'planning' | 'execution' | 'unknown'

/**
 * The output produced by the RequestClassifier.
 */
export interface ClassificationResult {
  /** Routing decision */
  type: RequestType
  /** 0–1 confidence in the routing decision */
  confidence: number
  /** Human-readable reason for the decision */
  reason: string
  /** Key signals extracted that drove the classification */
  signals: string[]
  /** Latency of the classification step in milliseconds */
  durationMs: number
}
