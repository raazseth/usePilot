// Execution Domain Types

export type ExecutionStatus =
  | 'created'
  | 'running'
  | 'paused'
  | 'waiting_approval'
  | 'recovering'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskExecutionStatus =
  | 'pending'
  | 'ready'
  | 'running'
  | 'waiting_approval'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'cancelled'
  | 'retrying'

export type FailureCategory =
  | 'adapter_failure'
  | 'verification_failure'
  | 'approval_denied'
  | 'dependency_failure'
  | 'timeout'
  | 'cancellation'
  | 'configuration'
  | 'unknown'
  // Granular operational failure taxonomy
  | 'planner_failure'
  | 'capability_failure'
  | 'permission_failure'
  | 'environment_failure'
  | 'user_cancellation'
  | 'policy_failure'
  | 'resource_failure'

export interface ExecutionRun {
  id: string
  planId: string
  blueprintHash: string
  traceId: string
  status: ExecutionStatus
  startedAt: number
  completedAt?: number | undefined
  errorCode?: string | undefined
  tasksTotal: number
  tasksCompleted: number
  tasksFailed: number
  tasksSkipped: number
  metadata?: Record<string, unknown> | undefined
}

export interface ExecutionTask {
  id: string
  runId: string
  taskId: string
  taskTitle: string
  capability: string
  status: TaskExecutionStatus
  attemptCount: number
  adapterName?: string | undefined
  adapterResult?: import('./adapter').AdapterResult | undefined
  verificationResult?: import('./verification').VerificationResult | undefined
  failureCategory?: FailureCategory | undefined
  startedAt?: number | undefined
  completedAt?: number | undefined
  errorMessage?: string | undefined
}

export interface TaskSummary {
  taskId: string
  taskTitle: string
  capability: string
  status: TaskExecutionStatus
  attemptCount: number
  durationMs?: number | undefined
  failureCategory?: FailureCategory | undefined
}

export interface ExecutionReport {
  runId: string
  traceId: string
  blueprintHash?: string | undefined
  executionHash?: string | undefined
  plannerVersion?: string | undefined
  executionVersion?: string | undefined
  adapterVersions?: Record<string, string> | undefined
  contextSnapshot?: import('./snapshot').ExecutionContextSnapshot | undefined
  summary: string
  taskSummaries: TaskSummary[]
  failureCategories: FailureCategory[]
  metrics: import('./metrics').ExecutionMetrics
  createdAt: number
}

export interface ExecutionResult {
  runId: string
  traceId: string
  status: ExecutionStatus
  tasksCompleted: number
  tasksFailed: number
  tasksSkipped: number
  durationMs: number
  report: ExecutionReport
  manifest?: import('./manifest').ExecutionManifest | undefined
}
