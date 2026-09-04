// ─────────────────────────────────────────────────────────────────────────────
// Goal Types
// A Goal represents the structured, validated form of the user's stated
// objective — after normalization and LLM extraction.
// ─────────────────────────────────────────────────────────────────────────────

/** Status lifecycle of a goal */
export type GoalStatus = 'pending' | 'extracting' | 'validated' | 'failed'

/**
 * The normalized form of a raw user input string.
 * The LLM never sees the raw string — only the normalized form.
 */
export interface NormalizedInput {
  /** The canonical, normalized text */
  text: string
  /** Original raw text before normalization */
  originalText: string
  /** Language detected (BCP 47 tag, e.g. 'en', 'hi') */
  detectedLanguage: string
  /** Named entities identified during normalization */
  entities: NormalizedEntity[]
  /** Normalization duration in milliseconds */
  durationMs: number
}

export interface NormalizedEntity {
  type: 'date' | 'time' | 'url' | 'email' | 'filepath' | 'currency' | 'person' | 'organization' | 'quantity'
  raw: string
  normalized: string
  /** Character offset in the normalized text */
  startOffset: number
  endOffset: number
}

/**
 * The primary domain object produced after goal extraction and validation.
 * This is the contract between the GoalExtractor/GoalValidator and the rest
 * of the planning pipeline.
 */
export interface Goal {
  /** Unique ID — set by the backend before persisting */
  id: string
  /** Plain-English statement of what needs to be accomplished */
  primaryObjective: string
  /** Constraints the planner must respect (e.g. "only free tools") */
  constraints: string[]
  /** Resources the user mentioned or that the objective implies */
  requiredResources: string[]
  /** What a successful outcome looks like */
  expectedOutcome: string
  /** Background context (e.g. "this is for a client's quarterly report") */
  context?: string | undefined
  /** 0–1 confidence that the objective was correctly extracted */
  confidence: number
  /** Source the normalized text came from */
  normalizedInput: NormalizedInput
  /** Lifecycle status */
  status: GoalStatus
  /** Unix timestamp (ms) */
  createdAt: number
}
