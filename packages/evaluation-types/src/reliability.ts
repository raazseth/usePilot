import { z } from 'zod'

export type ReliabilityConfidenceLevel = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

export const ReliabilityConfidenceLevelSchema = z.enum([
  'NONE',
  'LOW',
  'MEDIUM',
  'HIGH',
])

export interface SkillReliability {
  skillId: string
  version: string
  sampleCount: number
  successCount: number
  verificationCount: number
  successRate: number
  verificationRate: number
  retryRate: number
  failureRate: number
  confidence: ReliabilityConfidenceLevel
  lastEvaluatedAt: number
}

export const SkillReliabilitySchema = z.object({
  skillId: z.string().min(1),
  version: z.string().min(1),
  sampleCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  verificationCount: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  verificationRate: z.number().min(0).max(1),
  retryRate: z.number().min(0).max(1),
  failureRate: z.number().min(0).max(1),
  confidence: ReliabilityConfidenceLevelSchema,
  lastEvaluatedAt: z.number().positive(),
})

export interface WorkflowReliability {
  workflowId: string
  version: string
  sampleCount: number
  successCount: number
  verificationCount: number
  successRate: number
  verificationRate: number
  stepFailureRates: Record<string, number>
  mostCommonFailingStep?: string | undefined
  averageDurationMs: number
  retryRate: number
  replanRate: number
  confidence: ReliabilityConfidenceLevel
  lastEvaluatedAt: number
}

export const WorkflowReliabilitySchema = z.object({
  workflowId: z.string().min(1),
  version: z.string().min(1),
  sampleCount: z.number().int().nonnegative(),
  successCount: z.number().int().nonnegative(),
  verificationCount: z.number().int().nonnegative(),
  successRate: z.number().min(0).max(1),
  verificationRate: z.number().min(0).max(1),
  stepFailureRates: z.record(z.number()),
  mostCommonFailingStep: z.string().optional(),
  averageDurationMs: z.number().nonnegative(),
  retryRate: z.number().min(0).max(1),
  replanRate: z.number().min(0).max(1),
  confidence: ReliabilityConfidenceLevelSchema,
  lastEvaluatedAt: z.number().positive(),
})
