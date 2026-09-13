import type { TaskCapability, RiskLevel } from '@usepilot/planner-types'
import type {
  Skill,
  SkillCategory,
  SkillInputField,
  SkillOutputField,
  SkillContextRequirements,
  SkillVerificationDefinition,
} from './skill'

/**
 * SkillManifest — Deterministic, serializable description of a Skill.
 * Immutable after registration. Contains no runtime functions or closures.
 */
export interface SkillManifest {
  id: string
  name: string
  version: string
  description: string
  category: SkillCategory

  inputs: Record<string, SkillInputField>
  outputs: Record<string, SkillOutputField>

  capabilities: TaskCapability[]
  optionalCapabilities: TaskCapability[]
  permissions: string[]
  supportedPlatforms: ('windows' | 'macos' | 'linux')[]

  riskLevel: RiskLevel

  contextRequirements: SkillContextRequirements
  verification: SkillVerificationDefinition
  failurePolicy: {
    maxRetries: number
    allowFallback: boolean
    fallbackSkillId?: string | undefined
  }

  metadata: {
    tags: string[]
    examples: string[]
    icon?: string | undefined
    author?: string | undefined
    createdAt: number
    updatedAt: number
  }
}

/**
 * Converts a live Skill into its deterministic, JSON-serializable manifest.
 */
export function toSkillManifest(skill: Skill): SkillManifest {
  return {
    id: skill.id,
    name: skill.name,
    version: skill.version,
    description: skill.description,
    category: skill.category,
    inputs: skill.inputs,
    outputs: skill.outputs,
    capabilities: [...skill.requiredCapabilities],
    optionalCapabilities: [...(skill.optionalCapabilities ?? [])],
    permissions: [...(skill.requiredPermissions ?? [])],
    supportedPlatforms: [...(skill.supportedPlatforms ?? ['windows', 'macos', 'linux'])],
    riskLevel: skill.riskLevel,
    contextRequirements: { ...skill.contextRequirements },
    verification: { ...skill.verificationDefinition },
    failurePolicy: {
      maxRetries: skill.failurePolicy.maxRetries,
      allowFallback: skill.failurePolicy.allowFallback,
      fallbackSkillId: skill.failurePolicy.fallbackSkillId,
    },
    metadata: {
      tags: [...skill.metadata.tags],
      examples: [...skill.metadata.examples],
      icon: skill.metadata.icon,
      author: skill.metadata.author,
      createdAt: skill.metadata.createdAt,
      updatedAt: skill.metadata.updatedAt,
    },
  }
}
