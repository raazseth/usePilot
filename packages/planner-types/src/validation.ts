// ─────────────────────────────────────────────────────────────────────────────
// Validation Types
// Three distinct validation layers — each with a different responsibility.
// Schema: structural correctness
// Semantic: logical coherence
// Execution: feasibility for the execution engine
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Which validation layer produced an issue.
 */
export type ValidationLayer = 'schema' | 'semantic' | 'execution'

/**
 * Severity of a validation issue.
 */
export type ValidationSeverity = 'error' | 'warning' | 'suggestion'

/**
 * A single validation issue from any layer.
 */
export interface ValidationIssue {
  layer: ValidationLayer
  severity: ValidationSeverity
  code: string
  message: string
  /** Task ID or field path that caused the issue, if applicable */
  target?: string | undefined
}

/**
 * Result from a single validation layer.
 */
export interface LayerValidationResult {
  layer: ValidationLayer
  passed: boolean
  issues: ValidationIssue[]
  /** Validation duration in milliseconds */
  durationMs: number
}

/**
 * Aggregate result across all three validation layers.
 * Layers run sequentially — later layers only run if earlier ones pass.
 */
export interface ValidationResult {
  /** True only if all three layers passed with no errors */
  valid: boolean
  schema: LayerValidationResult
  semantic: LayerValidationResult
  execution: LayerValidationResult
  /** All errors across all layers */
  errors: ValidationIssue[]
  /** All warnings across all layers */
  warnings: ValidationIssue[]
  /** All suggestions across all layers */
  suggestions: ValidationIssue[]
  /** Total validation duration in ms */
  totalDurationMs: number
}
