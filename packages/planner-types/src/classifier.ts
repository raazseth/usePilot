// Request Classifier Types

/**
 * All top-level request routing categories.
 * 'conversation' — conversational chat dialog
 * 'planning'     — goal decomposition and planner pipeline
 * 'execution'    — direct task and tool execution engine
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
