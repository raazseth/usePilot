import type { Task, SuccessCriteria, RiskLevel, ApprovalPolicy } from '@usepilot/planner-types'

/**
 * Instantiated Workflow derived from a configured Skill.
 * Sits directly between the Skill resolution and the Planner.
 */
export interface Workflow {
  id: string
  skillId: string
  skillVersion: string
  name: string
  description: string
  inputs: Record<string, unknown>
  tasks: Task[]
  expectedOutputs: Record<string, unknown>
  verificationCriteria: SuccessCriteria[]
  policyHints: {
    riskLevel: RiskLevel
    approvalPolicy?: ApprovalPolicy | undefined
    timeoutMs?: number | undefined
  }
  metadata: {
    createdAt: number
    author?: string | undefined
    tags: string[]
  }
}

export interface WorkflowCompileOptions {
  workflowId?: string | undefined
  conversationId?: string | undefined
  platform?: ('windows' | 'macos' | 'linux') | undefined
}
