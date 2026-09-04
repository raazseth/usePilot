// Task Types

import type { Complexity } from './intent'

/**
 * Abstract capability required to execute this task.
 * The planner produces capabilities; Phase 3 maps capabilities to concrete tools/adapters.
 */
export type TaskCapability =
  | 'navigate_website'      // Browser navigation / page opening
  | 'download_file'         // File download from web / remote
  | 'read_file'             // File system read / inspect
  | 'write_file'            // File system create / write
  | 'move_file'             // File system move / rename / organize
  | 'delete_file'           // File system deletion
  | 'search_web'            // Web search engine query
  | 'extract_web_data'      // Web scraping / form / DOM extraction
  | 'authenticate_user'     // User login / credentials entry
  | 'send_communication'    // Email / messaging send
  | 'read_communication'    // Email / messaging retrieve
  | 'execute_command'       // Shell / command line execution
  | 'read_clipboard'        // Read system clipboard
  | 'write_clipboard'       // Write to system clipboard
  | 'call_api'              // HTTP REST / RPC request
  | 'transform_data'        // Pure computation / parsing / formatting
  | 'verify_state'          // Verification / assertion check
  | 'none'                  // No external capability needed

/**
 * Legacy concrete tool category.
 * In Phase 2, tasks declare abstract TaskCapability. Phase 3 maps capabilities to tools.
 */
export type TaskTool =
  | 'browser'      // Playwright / web automation
  | 'filesystem'   // File system read/write/organize
  | 'email'        // Email client (send, read, organize)
  | 'terminal'     // Shell command execution
  | 'clipboard'    // Read/write system clipboard
  | 'api'          // HTTP API call
  | 'none'         // Purely computational — no external tool needed

/**
 * Semantic category for grouping and filtering tasks in the UI.
 */
export type TaskCategory =
  | 'navigation'   // Moving between pages / locations
  | 'extraction'   // Reading / copying data
  | 'creation'     // Writing / creating files or content
  | 'modification' // Editing existing content or state
  | 'deletion'     // Removing files, records, or data
  | 'communication'// Sending messages / emails
  | 'verification' // Checking state, confirming conditions
  | 'computation'  // Processing, calculating, transforming data
  | 'organization' // Sorting, grouping, renaming
  | 'other'

/**
 * Approval policy for a task. Set by the ApprovalEngine.
 *
 * - automatic:  Execute without interruption
 * - optional:   User may choose to review before execution
 * - mandatory:  Must receive explicit human approval before running
 * - forbidden:  Task must never be executed — invalidates the plan
 */
export type ApprovalPolicy = 'automatic' | 'optional' | 'mandatory' | 'forbidden'

/**
 * How the execution engine should retry a failed task (Phase 3).
 */
export interface RetryPolicy {
  /** Maximum number of attempts (including the first) */
  maxAttempts: number
  /** Base delay between retries in milliseconds */
  backoffMs: number
  /** Whether to use exponential backoff */
  exponential: boolean
}

/**
 * What to do when this task fails (Phase 3).
 */
export interface FailureStrategy {
  /** 'abort' stops the entire plan. 'skip' moves to the next task. 'fallback' executes the fallbackTaskId. */
  onFailure: 'abort' | 'skip' | 'fallback'
  /** ID of the alternative task to run instead, when onFailure is 'fallback' */
  fallbackTaskId?: string | undefined
}

/**
 * A single, atomic, executable unit of work.
 * This is the core domain object of the planning system.
 */
export interface Task {
  /**
   * Stable ID for this task within the plan.
   * Must be unique within a TaskGraph.
   */
  id: string
  /** Human-readable title (imperative, ≤ 60 chars) */
  title: string
  /** Full description of what this task does */
  description: string
  /** Semantic category */
  category: TaskCategory
  /**
   * Abstract capability required to execute this task.
   * Phase 3 execution engine maps capabilities to concrete tools/adapters.
   */
  requiredCapability: TaskCapability
  /** Suggested/inferred tool for UI display and Phase 3 hints */
  requiredTool?: TaskTool | undefined
  /** Suggested concrete runner/adapter (e.g. 'playwright', 'chrome-extension') */
  suggestedTool?: string | undefined
  /** Optional tool-specific configuration (e.g. { url, selector } for browser tasks) */
  toolConfig?: Record<string, unknown> | undefined
  /** Expected concrete output or artifact from this task (e.g. 'filepath: ~/Downloads/invoice.pdf') */
  expectedOutput?: string | undefined
  /** Whether this task is optional for overall goal success */
  isOptional?: boolean | undefined
  /**
   * Conditions that must be true BEFORE this task can execute.
   * E.g. ["User is logged into Amazon", "Invoice filter is set to 2024"]
   */
  preconditions: string[]
  /**
   * Conditions that will be true AFTER this task succeeds.
   * E.g. ["Invoice download dialog is open", "File exists at ~/Downloads/invoice.pdf"]
   */
  postconditions: string[]
  /** What constitutes success for this task */
  successConditions: string[]
  /** What constitutes failure for this task */
  failureConditions: string[]
  /** IDs of tasks that must complete before this task can start */
  dependsOn: string[]
  /** Approval requirement for human review */
  approvalPolicy: ApprovalPolicy
  /** Human-readable reason why this policy was assigned */
  approvalReason?: string | undefined
  /** Estimated subjective complexity */
  complexity: Complexity
  /** Retry behavior on failure (Phase 3) */
  retryPolicy: RetryPolicy
  /** Failure behavior (Phase 3) */
  failureStrategy: FailureStrategy
  /** 0–1 confidence that this task is correct and complete */
  confidence: number
}
