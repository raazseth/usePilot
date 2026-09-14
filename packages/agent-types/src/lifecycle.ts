export type AgentLifecycleState =
  | 'RECEIVED'
  | 'UNDERSTANDING'
  | 'CONTEXT_RETRIEVAL'
  | 'STRATEGY_SELECTION'
  | 'CLARIFICATION_REQUIRED'
  | 'WORKFLOW_BUILDING'
  | 'WORKFLOW_VALIDATION'
  | 'APPROVAL_REQUIRED'
  | 'EXECUTING'
  | 'VERIFYING'
  | 'OUTCOME_ANALYSIS'
  | 'REPLANNING'
  | 'COMPLETED'
  | 'FAILED'
  | 'REJECTED'

export type AgentEventType =
  | 'agent.started'
  | 'agent.goal_understood'
  | 'agent.context_retrieved'
  | 'agent.strategy_selected'
  | 'agent.workflow_selected'
  | 'agent.workflow_composed'
  | 'agent.clarification_required'
  | 'agent.approval_required'
  | 'agent.execution_started'
  | 'agent.execution_completed'
  | 'agent.verification_completed'
  | 'agent.replan_started'
  | 'agent.completed'
  | 'agent.failed'
  | 'agent.rejected'

export interface AgentEvent {
  type: AgentEventType
  agentId: string
  goalId: string
  timestamp: number
  state: AgentLifecycleState
  payload?: Record<string, unknown> | undefined
}
