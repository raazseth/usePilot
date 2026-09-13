/**
 * Skill Composition Specification
 *
 * Enables composing multiple Skills into a composite workflow:
 * e.g., Skill A (Research Website) -> output -> Skill B (Save Report).
 */
export interface SkillCompositionStep {
  stepId: string
  skillId: string
  skillVersion?: string | undefined
  /**
   * Maps inputs of this step to either static values, or references to prior step outputs:
   * e.g., { filePath: '$steps.step1.downloadPath' }
   * Or structured form: { source: 'workflow_input', key: 'folder' }
   * Or initial input shorthand: '$initial.folder'
   */
  inputBindings: Record<string, string | unknown>
  isOptional?: boolean | undefined
}

export interface SkillComposition {
  id: string
  name: string
  description: string
  version: string
  steps: SkillCompositionStep[]
  tags?: string[] | undefined
  examples?: string[] | undefined
}

// ─── Runtime Orchestration Types ───────────────────────────────────────────

/**
 * Emitted by ComposedWorkflowOrchestrator after each step completes.
 * Allows callers to observe step-level progress without polling.
 */
export interface StepCompletionEvent {
  stepId: string
  skillId: string
  stepIndex: number
  totalSteps: number
  status: 'completed' | 'failed'
  durationMs: number
  outputs: Record<string, unknown>
}

/**
 * A single validation error produced by CompositionValidator.
 */
export interface CompositionValidationError {
  /**
   * - missing_skill: referenced skillId not in registry
   * - duplicate_step_id: two steps share the same stepId
   * - forward_reference: binding references a later step's output
   * - cycle_detected: step dependency graph contains a cycle
   * - unresolvable_binding: binding syntax is invalid
   */
  type: 'missing_skill' | 'duplicate_step_id' | 'forward_reference' | 'cycle_detected' | 'unresolvable_binding'
  stepId?: string | undefined
  detail: string
}

/**
 * The outcome of a CompositionValidator.validate() call.
 * Always returned (never throws) so callers can collect all errors at once.
 */
export interface CompositionValidationResult {
  valid: boolean
  errors: CompositionValidationError[]
}

/**
 * Per-step execution outcome recorded by ComposedWorkflowOrchestrator.
 */
export interface StepExecutionReceipt {
  stepId: string
  skillId: string
  /** completed = runner finished without error; failed = runner or verifier failure; skipped = isOptional and predecessor failed */
  status: 'completed' | 'failed' | 'skipped'
  /** Whether SkillVerifier confirmed the semantic outcome */
  verified: boolean
  durationMs: number
  /** Actual runtime outputs available to subsequent steps */
  outputs: Record<string, unknown>
  error?: string | undefined
}

/**
 * Final result returned by ComposedWorkflowOrchestrator.execute().
 */
export interface ComposedExecutionReceipt {
  compositionId: string
  compositionVersion: string
  /**
   * - completed: all steps finished and verified
   * - failed: at least one required step failed
   * - approval_required: a mandatory-approval step was reached and execution paused
   */
  status: 'completed' | 'failed' | 'approval_required'
  stepReceipts: StepExecutionReceipt[]
  /** Sum of all tasks executed across all steps */
  totalTasksExecuted: number
  durationMs: number
  /** If approval_required, the stepId whose blueprint triggered the gate */
  pendingApprovalStepId?: string | undefined
  error?: string | undefined
}

// ─── Goal → Workflow Routing Types ──────────────────────────────────────────

export interface WorkflowRouteRequest {
  goal: string
  context?: Record<string, unknown> | undefined
  availableCapabilities?: string[] | undefined
}

export type WorkflowRouteStatus =
  | 'matched_composition'
  | 'dynamic_composition'
  | 'single_skill'
  | 'requires_clarification'
  | 'conflicting_requirements'
  | 'destructive_rejected'
  | 'unsupported'

export interface WorkflowRouteResult {
  status: WorkflowRouteStatus
  composition?: SkillComposition | undefined
  singleSkillId?: string | undefined
  confidence: number
  reason: string
  missingInputs?: string[] | undefined
  detectedConflicts?: string[] | undefined
  suggestedSteps?: string[] | undefined
}

