// PlannerError

import type { PlanningStage } from '@usepilot/planner-types'

export enum PlannerErrorCode {
  ClassificationFailed      = 'CLASSIFICATION_FAILED',
  NormalizationFailed       = 'NORMALIZATION_FAILED',
  GoalExtractionFailed      = 'GOAL_EXTRACTION_FAILED',
  GoalValidationFailed      = 'GOAL_VALIDATION_FAILED',
  IntentAnalysisFailed      = 'INTENT_ANALYSIS_FAILED',
  TaskGenerationFailed      = 'TASK_GENERATION_FAILED',
  GraphBuildFailed          = 'GRAPH_BUILD_FAILED',
  SchemaValidationFailed    = 'SCHEMA_VALIDATION_FAILED',
  SemanticValidationFailed  = 'SEMANTIC_VALIDATION_FAILED',
  ExecutionValidationFailed = 'EXECUTION_VALIDATION_FAILED',
  ForbiddenTaskDetected     = 'FORBIDDEN_TASK_DETECTED',
  OptimizationFailed        = 'OPTIMIZATION_FAILED',
  SerializationFailed       = 'SERIALIZATION_FAILED',
  LLMRetryExhausted         = 'LLM_RETRY_EXHAUSTED',
  ProviderUnavailable       = 'PROVIDER_UNAVAILABLE',
  InvalidLLMResponse        = 'INVALID_LLM_RESPONSE',
  ContextBuildFailed        = 'CONTEXT_BUILD_FAILED',
}

export class PlannerError extends Error {
  readonly code: PlannerErrorCode
  readonly stage: PlanningStage
  readonly retries: number
  override readonly cause?: unknown

  constructor(options: {
    message: string
    code: PlannerErrorCode
    stage: PlanningStage
    retries?: number
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = 'PlannerError'
    this.code = options.code
    this.stage = options.stage
    this.retries = options.retries ?? 0
    this.cause = options.cause
  }

  static llmRetryExhausted(stage: PlanningStage, retries: number, lastError: unknown): PlannerError {
    return new PlannerError({
      message: `LLM failed to produce a valid response after ${retries} retries at stage '${stage}'.`,
      code: PlannerErrorCode.LLMRetryExhausted,
      stage,
      retries,
      cause: lastError,
    })
  }

  static invalidLLMResponse(stage: PlanningStage, details: string): PlannerError {
    return new PlannerError({
      message: `LLM returned an invalid response at stage '${stage}': ${details}`,
      code: PlannerErrorCode.InvalidLLMResponse,
      stage,
    })
  }

  static forbiddenTask(taskTitle: string, reason: string): PlannerError {
    return new PlannerError({
      message: `Plan contains a forbidden task: "${taskTitle}". Reason: ${reason}`,
      code: PlannerErrorCode.ForbiddenTaskDetected,
      stage: 'validating',
    })
  }
}
