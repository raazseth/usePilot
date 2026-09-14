
export interface SkillEvaluationMetrics {
  skillId: string
  version: string
  invocationCount: number
  successCount: number
  successRate: number
  verificationSuccessCount: number
  verificationSuccessRate: number
  failureCount: number
  failureRate: number
  retryCount: number
  retryRate: number
  recoveryCount: number
  recoveryRate: number
  averageDurationMs: number
  clarificationCount: number
  clarificationFrequency: number
  userCorrectionCount: number
  userCorrectionRate: number
  userRejectionCount: number
  userRejectionRate: number
  reuseFrequency: number
  failureCategories: Record<string, number>
}

export interface WorkflowStepEvaluationMetrics {
  stepId: string
  skillId: string
  invocationCount: number
  successCount: number
  failureCount: number
  verificationSuccessCount: number
  retryCount: number
  averageDurationMs: number
  failureReasonFrequency: Record<string, number>
}

export interface WorkflowEvaluationMetrics {
  workflowId: string
  version: string
  invocationCount: number
  successCount: number
  successRate: number
  verificationSuccessRate: number
  failureCount: number
  failureRate: number
  retryCount: number
  replanCount: number
  averageDurationMs: number
  userCorrectionCount: number
  userRejectionCount: number
  steps: Record<string, WorkflowStepEvaluationMetrics>
  bottleneckStep?: string | undefined
}

export interface AgentDecisionEvaluationRecord {
  id: string
  goalId: string
  goalText: string
  candidateStrategies: string[]
  selectedStrategy: string
  selectedSkills: string[]
  selectedWorkflow?: string | undefined
  confidence: string
  risk: string
  missingInformation: string[]
  requiresApproval: boolean
  isDecisionCorrect: boolean
  decisionErrorCategory?: string | undefined
  actualExecutionOutcome: string
  isExecutionSuccessful: boolean
  timestamp: number
}

export interface AgentEvaluationMetrics {
  totalGoals: number
  goalUnderstandingAccuracy: number
  strategySelectionAccuracy: number
  skillSelectionAccuracy: number
  workflowSelectionAccuracy: number
  parameterizationAccuracy: number
  clarificationAccuracy: number
  safetyComplianceRate: number
  replanningAccuracy: number
  decisionSuccessRate: number
  executionSuccessRate: number
}

export interface SystemEvaluationMetrics {
  totalExecutions: number
  overallSuccessRate: number
  verificationSuccessRate: number
  clarificationRate: number
  totalReplans: number
  totalRetries: number
  topFailureCategories: Record<string, number>
}
