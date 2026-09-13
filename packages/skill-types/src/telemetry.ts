/**
 * Telemetry record for a Skill execution.
 */
export interface SkillExecutionTelemetry {
  skillId: string
  skillVersion: string
  workflowId: string
  runId: string
  executionId?: string | undefined
  conversationId?: string | undefined

  startedAt: number
  completedAt?: number | undefined
  durationMs: number

  success: boolean
  verificationSuccess: boolean
  retryCount: number

  failureCategory?: string | undefined
  errorMessage?: string | undefined

  approvalRequired: boolean
  approvalGranted: boolean

  tasksTotal: number
  tasksCompleted: number
  tasksFailed: number
}
