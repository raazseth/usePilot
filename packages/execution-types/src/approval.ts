// Approval Types

import type { TaskCapability, ApprovalPolicy } from '@usepilot/planner-types'

export interface ApprovalRequest {
  id: string
  runId: string
  taskId: string
  taskTitle: string
  capability: TaskCapability
  approvalReason: string
  policy: ApprovalPolicy
  requestedAt: number
  expiresAt?: number | undefined
}

export interface ApprovalResponse {
  requestId: string
  taskId: string
  approved: boolean
  comment?: string | undefined
  respondedAt: number
}
