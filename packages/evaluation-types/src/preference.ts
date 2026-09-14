import { z } from 'zod'

export type PreferenceConfidence = 'LOW' | 'MEDIUM' | 'HIGH'

export const PreferenceConfidenceSchema = z.enum(['LOW', 'MEDIUM', 'HIGH'])

export type PreferenceStatus = 'CANDIDATE' | 'VALIDATED'

export const PreferenceStatusSchema = z.enum(['CANDIDATE', 'VALIDATED'])

export interface UserPreference {
  id: string
  key: string
  value: unknown
  observationCount: number
  confidence: PreferenceConfidence
  status: PreferenceStatus
  source: string
  lastObservedAt: number
  lastValidatedAt: number
  metadata?: Record<string, unknown> | undefined
}

export const UserPreferenceSchema = z.object({
  id: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown(),
  observationCount: z.number().int().nonnegative(),
  confidence: PreferenceConfidenceSchema,
  status: PreferenceStatusSchema,
  source: z.string().min(1),
  lastObservedAt: z.number().positive(),
  lastValidatedAt: z.number().positive(),
  metadata: z.record(z.unknown()).optional(),
})

export type PreferenceResolutionSource =
  | 'EXPLICIT_INPUT'
  | 'SAFETY_POLICY'
  | 'RUNTIME_STATE'
  | 'VALIDATED_PREFERENCE'
  | 'HISTORICAL_PATTERN'
  | 'SAFE_DEFAULT'

export interface PreferenceResolutionContext {
  key: string
  explicitInput?: unknown | undefined
  systemSafetyPermitted: boolean
  currentRuntimeValid: boolean
  validatedPreference?: unknown | undefined
  historicalPattern?: unknown | undefined
  safeDefault: unknown
}

export interface PreferenceResolutionResult {
  key: string
  resolvedValue: unknown
  resolvedSource: PreferenceResolutionSource
  reason: string
}
