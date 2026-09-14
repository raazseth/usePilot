import type { ComposedExecutionReceipt } from '@usepilot/skill-types'

import type { AgentConfidence, AgentRiskLevel } from './goal'

export type AgentOutcomeStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'VERIFICATION_FAILURE'
  | 'EXECUTION_FAILURE'
  | 'BLOCKED'
  | 'CLARIFICATION_REQUIRED'

export interface AgentExecutionOutcome {
  status: AgentOutcomeStatus
  agentId: string
  goalId: string
  workflowId?: string | undefined
  executionReceipt?: ComposedExecutionReceipt | undefined
  verificationStatus: boolean
  summary: string
  durationMs: number
  replanCount: number
  userExplanation: string
  outputs?: Record<string, unknown> | undefined
}

export interface AgentTelemetryRecord {
  agentExecutionId: string
  goalId: string
  agentId: string
  agentVersion: string
  selectedStrategy: string
  selectedWorkflow?: string | undefined
  selectedSkills: string[]
  confidence: AgentConfidence
  riskLevel: AgentRiskLevel
  contextSources: string[]
  memoryUsed: boolean
  clarificationCount: number
  approvalCount: number
  replanCount: number
  executionId?: string | undefined
  verificationStatus: boolean
  finalOutcome: AgentOutcomeStatus
  failureCategory?: string | undefined
  durationMs: number
}
