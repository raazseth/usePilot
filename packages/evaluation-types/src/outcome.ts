import { z } from 'zod'

export type ExecutionOutcomeStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'VERIFICATION_FAILURE'
  | 'BLOCKED'
  | 'CLARIFICATION_REQUIRED'
  | 'USER_CORRECTED'
  | 'USER_REJECTED'

export const ExecutionOutcomeStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'VERIFICATION_FAILURE',
  'BLOCKED',
  'CLARIFICATION_REQUIRED',
  'USER_CORRECTED',
  'USER_REJECTED',
])

export type FailureCategory =
  | 'GOAL_UNDERSTANDING'
  | 'PARAMETER'
  | 'SKILL_SELECTION'
  | 'WORKFLOW_SELECTION'
  | 'WORKFLOW_COMPOSITION'
  | 'CAPABILITY'
  | 'PERMISSION'
  | 'BROWSER'
  | 'FILESYSTEM'
  | 'DESKTOP'
  | 'NETWORK'
  | 'AUTHENTICATION'
  | 'VERIFICATION'
  | 'RUNTIME'
  | 'TIMEOUT'
  | 'USER_INPUT'
  | 'EXTERNAL_CONTENT'
  | 'UNKNOWN'

export const FailureCategorySchema = z.enum([
  'GOAL_UNDERSTANDING',
  'PARAMETER',
  'SKILL_SELECTION',
  'WORKFLOW_SELECTION',
  'WORKFLOW_COMPOSITION',
  'CAPABILITY',
  'PERMISSION',
  'BROWSER',
  'FILESYSTEM',
  'DESKTOP',
  'NETWORK',
  'AUTHENTICATION',
  'VERIFICATION',
  'RUNTIME',
  'TIMEOUT',
  'USER_INPUT',
  'EXTERNAL_CONTENT',
  'UNKNOWN',
])

export interface UserFeedbackSignal {
  type: 'SATISFACTION' | 'CORRECTION' | 'REJECTION'
  comment?: string | undefined
  correctedValue?: string | undefined
  rejectedReason?: string | undefined
  rating?: number | undefined
  timestamp: number
}

export interface ExecutionOutcome {
  id: string
  executionId: string
  goalId: string
  agentId: string
  agentVersion: string
  workflowId?: string | undefined
  workflowVersion?: string | undefined
  skillIds: string[]
  skillVersions: Record<string, string>
  status: ExecutionOutcomeStatus
  verificationStatus: boolean
  failureCategory?: FailureCategory | undefined
  failureReason?: string | undefined
  durationMs: number
  retryCount: number
  replanCount: number
  userCorrection?: string | undefined
  userRejection?: string | undefined
  userSatisfaction?: string | undefined
  artifacts: string[]
  trustReceipt?: string | undefined
  timestamp: number
  metadata?: Record<string, unknown> | undefined
}

export const ExecutionOutcomeSchema = z.object({
  id: z.string().min(1),
  executionId: z.string().min(1),
  goalId: z.string().min(1),
  agentId: z.string().min(1),
  agentVersion: z.string().min(1),
  workflowId: z.string().optional(),
  workflowVersion: z.string().optional(),
  skillIds: z.array(z.string()),
  skillVersions: z.record(z.string()),
  status: ExecutionOutcomeStatusSchema,
  verificationStatus: z.boolean(),
  failureCategory: FailureCategorySchema.optional(),
  failureReason: z.string().optional(),
  durationMs: z.number().nonnegative(),
  retryCount: z.number().nonnegative(),
  replanCount: z.number().nonnegative(),
  userCorrection: z.string().optional(),
  userRejection: z.string().optional(),
  userSatisfaction: z.string().optional(),
  artifacts: z.array(z.string()),
  trustReceipt: z.string().optional(),
  timestamp: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
})
