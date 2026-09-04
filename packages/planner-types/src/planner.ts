// ─────────────────────────────────────────────────────────────────────────────
// Planner Runtime Types
// Planning stages, status, and the context object that flows into every
// LLM-powered stage of the pipeline.
// ─────────────────────────────────────────────────────────────────────────────

import type { TaskTool, TaskCapability } from './task'
import type { BlueprintSummary } from './blueprint'

/**
 * The ordered stages of the planning pipeline.
 * Used in progress events streamed to the frontend.
 */
export type PlanningStage =
  | 'classifying'            // RequestClassifier
  | 'normalizing'            // Normalizer
  | 'extracting'             // GoalExtractor
  | 'validating_goal'        // GoalValidator
  | 'detecting_missing_info' // MissingInformationDetector
  | 'analyzing'              // IntentAnalyzer
  | 'generating'             // TaskGenerator
  | 'building'               // GraphBuilder
  | 'validating'             // Three-layer validation
  | 'optimizing'             // PlanOptimizer
  | 'explaining'             // PlanExplainer
  | 'serializing'            // PlanSerializer
  | 'persisting'             // Database write
  | 'ready'                  // Complete

/**
 * Context passed into every LLM-powered stage of the planning pipeline.
 * Ensures planning is always environment-aware.
 */
export interface PlannerContext {
  /** The conversation this planning session belongs to */
  conversationId: string
  /** Compact history of the conversation for context injection */
  conversationHistory: ConversationHistoryEntry[]
  /** Active user settings snapshot */
  settings: PlannerSettingsContext
  /** Tools registered and available on this machine (legacy/adapter hint) */
  availableTools: TaskTool[]
  /** Abstract capabilities available on this system */
  availableCapabilities?: TaskCapability[] | undefined
  /** Discovered installed applications on this host */
  installedApplications?: string[] | undefined
  /** Discovered installed web browsers (e.g. ['chrome', 'edge', 'firefox']) */
  availableBrowsers?: string[] | undefined
  /** Filesystem permissions granted (e.g. ['read_downloads', 'write_documents']) */
  filesystemPermissions?: string[] | undefined
  /** AI provider capabilities (e.g. ['json_mode', 'tools', 'vision']) */
  providerCapabilities?: string[] | undefined
  /** OS platform — affects tool selection and path formats */
  platform: 'windows' | 'macos' | 'linux'
  /**
   * The N most recent blueprints for this user.
   * Injected into prompts so the LLM can avoid repeating past patterns.
   */
  previousBlueprints: BlueprintSummary[]
  /** Free-form user preferences (e.g. language, preferred apps) */
  userPreferences?: Record<string, unknown> | undefined
}

export interface ConversationHistoryEntry {
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

export interface PlannerSettingsContext {
  activeProviderType?: string | undefined
  defaultModel?: string | undefined
  temperature: number
  featureFlags: Record<string, unknown>
}

/**
 * A database-persisted planning run.
 * Records every attempt — including failures.
 */
export interface PlannerRun {
  id: string
  goalId: string
  conversationId: string
  /** Current status of this run */
  status: PlannerRunStatus
  /** The last stage that was reached before completion or failure */
  stageReached: PlanningStage
  startedAt: number
  completedAt?: number | undefined
  /** Error code if status is 'failed' */
  errorCode?: string | undefined
  /** Number of LLM retries used */
  retries: number
  /** Total tokens consumed across all LLM calls */
  tokenCount: number
}

export type PlannerRunStatus = 'started' | 'succeeded' | 'failed' | 'cancelled'
