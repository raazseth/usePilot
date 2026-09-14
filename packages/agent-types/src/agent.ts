import { z } from 'zod'

export interface AgentRiskPolicy {
  autoApproveLowRisk: boolean
  requireApprovalForMediumRisk: boolean
  requireApprovalForHighRisk: boolean
  blockCriticalRisk: boolean
}

export interface AgentApprovalPolicy {
  mode: 'always' | 'on_mutation' | 'on_risk_threshold' | 'never'
  riskThreshold: 'low' | 'medium' | 'high'
}

/**
 * Immutable manifest defining an Agent's identity, capabilities,
 * safety constraints, and loop boundaries.
 */
export interface AgentManifest {
  id: string
  name: string
  description: string
  version: string
  supportedDomains: string[]
  allowedSkillIds?: string[] | undefined
  allowedWorkflowIds?: string[] | undefined
  inputContract?: Record<string, unknown> | undefined
  outputContract?: Record<string, unknown> | undefined
  requiredCapabilities: string[]
  riskPolicy: AgentRiskPolicy
  approvalPolicy: AgentApprovalPolicy
  maxReplans: number
  maxSteps: number
  maxIterations: number
}

export const AgentRiskPolicySchema = z.object({
  autoApproveLowRisk: z.boolean(),
  requireApprovalForMediumRisk: z.boolean(),
  requireApprovalForHighRisk: z.boolean(),
  blockCriticalRisk: z.boolean(),
})

export const AgentApprovalPolicySchema = z.object({
  mode: z.enum(['always', 'on_mutation', 'on_risk_threshold', 'never']),
  riskThreshold: z.enum(['low', 'medium', 'high']),
})

export const AgentManifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  version: z.string().min(1),
  supportedDomains: z.array(z.string()).min(1),
  allowedSkillIds: z.array(z.string()).optional(),
  allowedWorkflowIds: z.array(z.string()).optional(),
  inputContract: z.record(z.unknown()).optional(),
  outputContract: z.record(z.unknown()).optional(),
  requiredCapabilities: z.array(z.string()),
  riskPolicy: AgentRiskPolicySchema,
  approvalPolicy: AgentApprovalPolicySchema,
  maxReplans: z.number().int().min(0).max(10).default(2),
  maxSteps: z.number().int().min(1).max(50).default(10),
  maxIterations: z.number().int().min(1).max(20).default(5),
})
