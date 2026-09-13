import type { TaskCapability, Intent } from '@usepilot/planner-types'
import type { Skill, SkillCategory } from './skill'

export type SkillMatchConfidence = 'clear' | 'ambiguous' | 'insufficient_context' | 'unsupported'
 
 /**
  * Result of Skill Discovery matching.
  */
 export interface SkillCandidate {
   skillId: string
   skillVersion: string
   name: string
   description: string
   score: number
   confidence?: SkillMatchConfidence | undefined
   reasons: string[]
   matchedExamples: string[]
   missingInputs: string[]
   unavailableCapabilities: TaskCapability[]
   isResolvable: boolean
   skill: Skill
 }

/**
 * Query used to discover candidate Skills from a user prompt.
 */
export interface SkillDiscoveryQuery {
  userPrompt?: string | undefined
  text?: string | undefined
  category?: SkillCategory | undefined
  intent?: Intent | undefined
  availableCapabilities?: TaskCapability[] | undefined
  platform?: ('windows' | 'macos' | 'linux') | undefined
  installedTools?: string[] | undefined
}
