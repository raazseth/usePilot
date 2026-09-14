import { z } from 'zod'

import type { SkillPackage } from './skill-package'

export type SkillTrustLevel = 'BUILTIN' | 'USER' | 'VERIFIED' | 'UNTRUSTED'

export const SkillTrustLevelSchema = z.enum(['BUILTIN', 'USER', 'VERIFIED', 'UNTRUSTED'])

export interface SkillTrustRecord {
  skillId: string
  version: string
  trustLevel: SkillTrustLevel
  approvedByUser: boolean
  contentHash: string
  manifestHash: string
  installedAt: number
  lastVerifiedAt: number
  revoked: boolean
  revocationReason?: string | undefined
}

export interface SkillInstallRequest {
  skillPackage: SkillPackage
  targetTrustLevel?: SkillTrustLevel | undefined
  userApproved: boolean
}

export interface SkillInstallResult {
  success: boolean
  skillId: string
  version: string
  trustLevel: SkillTrustLevel
  error?: string | undefined
}

export interface SkillRemovalResult {
  success: boolean
  skillId: string
  retainedHistoricalRecords: boolean
  error?: string | undefined
}
