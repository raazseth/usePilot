import type { ApprovalPolicy, Complexity, RiskLevel, TaskCapability, TaskCategory } from '@usepilot/planner-types'
import type { z } from 'zod'

export type SkillCategory = 'filesystem' | 'browser' | 'desktop' | 'data' | 'cross_runtime'

export type SkillInputType = 'string' | 'number' | 'boolean' | 'path' | 'url' | 'array' | 'object'

export interface SkillInputField {
  name: string
  type: SkillInputType
  description: string
  required: boolean
  default?: unknown
  /** Sensitive inputs integrate with Secret Vault and are masked in logs/telemetry */
  sensitive?: boolean | undefined
  /** Human-friendly question shown if input is missing */
  promptQuestion?: string | undefined
  examples?: string[] | undefined
}

export interface SkillOutputField {
  name: string
  type: SkillInputType
  description: string
}

export interface SkillContextRequirements {
  needsFilesystemState?: boolean | undefined
  needsBrowserState?: boolean | undefined
  needsDesktopState?: boolean | undefined
  needsDomainKnowledge?: boolean | undefined
  requiredDomains?: string[] | undefined
  targetPaths?: string[] | undefined
}

export interface SkillVerificationDefinition {
  conditions: string[]
  strategy: 'state_check' | 'file_exists' | 'dom_check' | 'checksum' | 'custom'
  customVerifier?: string | undefined
}

export interface SkillFailurePolicy {
  maxRetries: number
  allowFallback: boolean
  fallbackSkillId?: string | undefined
  /** Maps error codes to semantic human guidance */
  semanticGuidance?: Record<string, string> | undefined
}

export interface SkillMetadata {
  author?: string | undefined
  tags: string[]
  examples: string[]
  icon?: string | undefined
  category: SkillCategory
  createdAt: number
  updatedAt: number
}

export interface WorkflowTaskTemplate {
  id: string
  title: string
  description: string
  category?: TaskCategory | undefined
  requiredCapability: TaskCapability
  /** Builds concrete toolConfig from resolved inputs */
  toolConfigFactory: (inputs: Record<string, unknown>) => Record<string, unknown>
  preconditions: string[]
  postconditions: string[]
  successConditions: string[]
  failureConditions?: string[] | undefined
  dependsOn: string[]
  approvalPolicy?: ApprovalPolicy | undefined
  approvalReason?: string | undefined
  complexity?: Complexity | undefined
}

export interface WorkflowDefinition {
  /** Generates ordered task templates using resolved inputs */
  generateTasks: (inputs: Record<string, unknown>) => WorkflowTaskTemplate[]
  estimatedComplexity: Complexity
  timeoutMs?: number | undefined
}

/**
 * Skill — First-Class Reusable User-Facing Ability
 *
 * Sits above Planner and Execution. Composed of atomic TaskCapabilities.
 */
export interface Skill {
  id: string
  name: string
  description: string
  version: string
  category: SkillCategory

  inputs: Record<string, SkillInputField>
  inputSchema: z.ZodType<Record<string, unknown>>
  outputs: Record<string, SkillOutputField>
  outputSchema?: z.ZodType<Record<string, unknown>> | undefined

  requiredCapabilities: TaskCapability[]
  optionalCapabilities?: TaskCapability[] | undefined
  requiredPermissions?: string[] | undefined
  supportedPlatforms?: ('windows' | 'macos' | 'linux')[] | undefined

  riskLevel: RiskLevel

  workflowDefinition: WorkflowDefinition
  verificationDefinition: SkillVerificationDefinition
  failurePolicy: SkillFailurePolicy
  contextRequirements: SkillContextRequirements
  metadata: SkillMetadata
}
