import { z } from 'zod'

export type AgentConfidence = 'HIGH' | 'MEDIUM' | 'LOW'
export type AgentRiskLevel = 'low' | 'medium' | 'high' | 'critical'

/**
 * Normalized internal representation of a user objective.
 */
export interface AgentGoal {
  id: string
  rawInput: string
  normalizedGoal: string
  intent: string
  desiredOutcome: string
  constraints: string[]
  preferences?: Record<string, unknown> | undefined
  requiredInformation: string[]
  missingInformation: string[]
  riskLevel: AgentRiskLevel
  confidence: AgentConfidence
  contextReferences?: string[] | undefined
}

export const AgentConfidenceSchema = z.enum(['HIGH', 'MEDIUM', 'LOW'])
export const AgentRiskLevelSchema = z.enum(['low', 'medium', 'high', 'critical'])

export const AgentGoalSchema = z.object({
  id: z.string().min(1),
  rawInput: z.string().min(1),
  normalizedGoal: z.string().min(1),
  intent: z.string().min(1),
  desiredOutcome: z.string().min(1),
  constraints: z.array(z.string()),
  preferences: z.record(z.unknown()).optional(),
  requiredInformation: z.array(z.string()),
  missingInformation: z.array(z.string()),
  riskLevel: AgentRiskLevelSchema,
  confidence: AgentConfidenceSchema,
  contextReferences: z.array(z.string()).optional(),
})
