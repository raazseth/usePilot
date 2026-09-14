import type { TaskCapability } from '@usepilot/planner-types'
import type {
  SkillManifest,
  WorkflowDefinition,
  SkillVerificationDefinition,
} from '@usepilot/skill-types'

export interface SkillPackageIntegrity {
  contentHash: string
  manifestHash: string
  algorithm: 'sha256'
}

export interface SkillPackageCompatibility {
  minAppVersion?: string | undefined
  supportedPlatforms?: string[] | undefined
}

export interface SkillPackage {
  id: string
  version: string
  description: string
  manifest: SkillManifest
  inputSchema: Record<string, unknown>
  outputSchema: Record<string, unknown>
  requiredCapabilities: TaskCapability[]
  permissions: string[]
  workflow: WorkflowDefinition
  verification: SkillVerificationDefinition
  knowledgeRequirements?: string[] | undefined
  compatibility: SkillPackageCompatibility
  author: string
  source: string
  integrity: SkillPackageIntegrity
  createdAt: number
}

export interface SkillPackageValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}
