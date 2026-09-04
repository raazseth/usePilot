// ─────────────────────────────────────────────────────────────────────────────
// Intent Types
// Intent represents what category of action the goal requires, the risk
// profile, and what is missing before planning can proceed.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The broad category of actions required to accomplish the goal.
 */
export type IntentType =
  | 'browser'      // Web browsing, scraping, form filling
  | 'desktop'      // Desktop application control (non-browser)
  | 'filesystem'   // File reading, writing, organizing
  | 'email'        // Composing, sending, reading emails
  | 'research'     // Searching, reading, summarizing information
  | 'mixed'        // Combines multiple tool types
  | 'unknown'      // Intent analyzer was unable to classify

/**
 * Estimated subjective complexity of the goal.
 * Runtime belongs to the execution engine — the planner only estimates complexity.
 */
export type Complexity = 'low' | 'medium' | 'high' | 'unknown'

/**
 * Risk classification for the intent.
 */
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Result of the IntentAnalyzer.
 * Derived from the Goal and PlannerContext together.
 */
export interface Intent {
  /** Category of actions required */
  type: IntentType
  /** Subtypes when intent is mixed */
  subTypes?: IntentType[] | undefined
  /** Overall risk to the user's system/data */
  riskLevel: RiskLevel
  /** Estimated complexity of the overall plan */
  complexity: Complexity
  /** Whether any task will require human approval before execution */
  requiresHumanApproval: boolean
  /**
   * Information the planner would need but the user did not provide.
   * If non-empty, the frontend should prompt for clarification (Phase 3+).
   */
  missingInformation: string[]
  /** 0–1 confidence in the intent classification */
  confidence: number
  /** Analysis duration in ms */
  durationMs: number
}
