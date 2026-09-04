// ExecutionBlueprint Types

import type { Goal } from './goal'
import type { Intent, Complexity } from './intent'
import type { Task, ApprovalPolicy } from './task'
import type { TaskGraph } from './graph'

/**
 * A summary of all approval requirements across a blueprint.
 */
export interface ApprovalSummary {
  /** Whether any task requires mandatory human approval */
  requiresMandatoryApproval: boolean
  /** Whether any task is marked forbidden (plan is invalid if true) */
  hasForbiddenTasks: boolean
  /** IDs of tasks with mandatory approval policy */
  mandatoryTaskIds: string[]
  /** IDs of tasks with optional approval policy */
  optionalTaskIds: string[]
  /** IDs of tasks marked forbidden */
  forbiddenTaskIds: string[]
}

/**
 * A measurable condition the execution engine can verify (Phase 3).
 */
export interface SuccessCriteria {
  /** Human-readable condition statement */
  condition: string
  /**
   * How the execution engine will verify this condition.
   * 'screenshot' means visual inspection (Phase 3+ only).
   */
  verificationStrategy: 'state_check' | 'file_exists' | 'api_response' | 'screenshot' | 'manual'
  /** Whether this criterion is required for the plan to be considered complete */
  required: boolean
}

/**
 * A snapshot of the planner context used during planning.
 * Stored inside the blueprint for full reproducibility.
 */
export interface PlannerContextSnapshot {
  platform: string
  availableTools: string[]
  settingsSnapshot: Record<string, unknown>
  previousBlueprintCount: number
}

/**
 * A summary of optimizations applied by the PlanOptimizer.
 */
export interface OptimizationResult {
  /** Pairs of task IDs that were merged into one */
  mergedTasks: Array<{ from: string[]; into: string }>
  /** Task IDs that were removed as exact duplicates */
  removedDuplicates: string[]
  /** New parallel groups discovered by the optimizer */
  newParallelGroups: string[][]
  /** Human-readable list of simplifications applied */
  simplifications: string[]
  /** Whether any changes were made */
  changed: boolean
}

/**
 * Explains why the planner formulated this blueprint.
 * Provides transparent reasoning, assumptions, and tradeoffs to the user.
 */
export interface PlanExplanation {
  /** Concise summary of the chosen plan strategy */
  summary: string
  /** Key decisions and reasons why this strategy was chosen */
  reasoning: string[]
  /** Assumptions made about the environment, inputs, or user intent */
  assumptions: string[]
  /** Tradeoffs evaluated (e.g. speed vs safety, serial vs concurrent) */
  tradeoffs: string[]
  /** Safety and governance assessment */
  riskAssessment: string
}

/**
 * The fully-resolved, validated, and optimized execution blueprint.
 * This is what the Phase 2 planner produces.
 *
 * Phase 3 will add an 'execution' field alongside this.
 * Phase 3 must not require changes to this type to begin execution.
 */
export interface ExecutionBlueprint {
  /** Database-assigned ID */
  id: string
  /** Monotonically increasing version for this goal's plans */
  version: number
  /** SHA-256 content hash of the canonical JSON representation */
  hash: string
  /** Lifecycle status of the plan */
  status?: PlanStatus | undefined
  /** The extracted, validated goal */
  goal: Goal
  /** The analyzed intent */
  intent: Intent
  /** The full ordered task list (matches graph.nodes order) */
  tasks: Task[]
  /** The explicit DAG */
  graph: TaskGraph
  /** Approval summary derived from task policies */
  approvals: ApprovalSummary
  /** Conditions the execution engine must verify after completion */
  successCriteria: SuccessCriteria[]
  /** Overall complexity derived from tasks */
  estimatedComplexity: Complexity
  /** Optimizations applied */
  optimization: OptimizationResult
  /** Calibrated overall planner confidence (0.0 to 1.0) */
  plannerConfidence?: number | undefined
  /** Transparent reasoning and tradeoffs explaining why this plan was chosen */
  explanation?: PlanExplanation | undefined
  /** Snapshot of context used during planning (for reproducibility) */
  plannerContext: PlannerContextSnapshot
  /** Unix timestamp (ms) of blueprint creation */
  createdAt: number
}

/**
 * A lightweight summary of an ExecutionBlueprint for listing in the UI
 * or for inclusion as previous-plan context.
 */
export interface BlueprintSummary {
  id: string
  version: number
  hash: string
  primaryObjective: string
  taskCount: number
  estimatedComplexity: Complexity
  status: PlanStatus
  createdAt: number
}

/**
 * Lifecycle status of a plan in the database.
 */
export type PlanStatus =
  | 'pending'
  | 'generating'
  | 'validating'
  | 'optimizing'
  | 'needs_info'
  | 'ready'
  | 'invalid'
  | 'executing'    // Phase 3
  | 'completed'    // Phase 3
  | 'failed'       // Phase 3
