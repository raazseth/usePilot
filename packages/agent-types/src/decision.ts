import type { SkillComposition } from '@usepilot/skill-types'

import type { AgentConfidence, AgentGoal, AgentRiskLevel } from './goal'

export type AgentDecisionType =
  | 'EXECUTE'
  | 'CLARIFY'
  | 'REJECT'
  | 'COMPOSE'
  | 'REUSE_WORKFLOW'
  | 'REPLAN'

export interface AgentExecutionRequest {
  agentId: string
  goalId: string
  workflowId: string
  composition: SkillComposition
  inputs: Record<string, unknown>
  approvalGranted?: boolean | undefined
  riskLevel: AgentRiskLevel
}

/**
 * Structured reasoning output produced by AgentOrchestrator and StrategySelector.
 * Fully validated prior to handing off to deterministic execution.
 */
export interface AgentDecision {
  decisionType: AgentDecisionType
  goal: AgentGoal
  strategy: string
  selectedSkills: string[]
  selectedWorkflow?: string | undefined
  workflowDefinition?: SkillComposition | undefined
  confidence: AgentConfidence
  riskLevel: AgentRiskLevel
  requiredApproval: boolean
  missingInformation: string[]
  reason: string
  alternatives?: string[] | undefined
  executionRequest?: AgentExecutionRequest | undefined
}
