import type { TaskCapability } from '@usepilot/planner-types'
import type { Skill } from './skill'

export interface MissingInputDetail {
  name: string
  description: string
  type: string
  promptQuestion: string
  examples?: string[] | undefined
}

export interface InvalidInputDetail {
  name: string
  reason: string
  value?: unknown
}

export type SkillResolutionStatus =
  | 'ready'
  | 'missing_input'
  | 'invalid_input'
  | 'unavailable_capabilities'
  | 'unsupported_platform'
  | 'permission_denied'

/**
 * Result of resolving a Skill with provided inputs against runtime constraints.
 */
export interface SkillResolution {
  success: boolean
  skillId: string
  skillVersion: string
  status: SkillResolutionStatus

  /** Cleaned, validated, and defaulted inputs */
  configuredInputs: Record<string, unknown>

  /** Inputs required by the skill but not provided */
  missingInputs: MissingInputDetail[]

  /** Inputs provided but failed validation */
  invalidInputs: InvalidInputDetail[]

  /** Capabilities required by the skill that are not available on this host */
  missingCapabilities: TaskCapability[]

  /** Permissions required by the skill that have not been granted */
  missingPermissions: string[]

  /** If missing_input, a structured question for the user */
  userPromptRequired?: string | undefined

  skill: Skill
}

export interface SkillRuntimeContextSnapshot {
  activeBrowserUrl?: string | undefined
  activeBrowserTitle?: string | undefined
  activeDirectory?: string | undefined
  selectedFiles?: string[] | undefined
  clipboardText?: string | undefined
  recentDownloads?: string[] | undefined
  previousSuccessfulWorkflow?: {
    skillId: string
    inputs: Record<string, unknown>
  } | undefined
}

export interface ResolutionContext {
  availableCapabilities?: TaskCapability[] | undefined
  grantedPermissions?: string[] | undefined
  platform?: ('windows' | 'macos' | 'linux') | undefined
  /** Natural language user prompt from which parameters may be extracted */
  userPrompt?: string | undefined
  /** Runtime Context state snapshot */
  runtimeContext?: SkillRuntimeContextSnapshot | undefined
}
