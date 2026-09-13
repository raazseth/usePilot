import type { TaskCapability } from '@usepilot/planner-types'
import type { Skill, SkillManifest, SkillCategory } from '@usepilot/skill-types'
import { toSkillManifest } from '@usepilot/skill-types'

export interface SkillValidationResult {
  valid: boolean
  errors: string[]
}

export interface SkillAvailability {
  available: boolean
  missingCapabilities: TaskCapability[]
  missingPermissions: string[]
  unsupportedPlatform: boolean
}

/**
 * SkillRegistry — Central repository for registered Skills.
 *
 * Responsibilities:
 * - register / unregister / get / list / has / resolve / validate
 * - reject duplicate Skill IDs
 * - validate manifests and required capabilities
 * - expose availability state per host
 * - deterministic lookup
 */
export class SkillRegistry {
  private readonly skills = new Map<string, Skill>()
  private readonly aliases = new Map<string, string>()

  /**
   * Register a Skill. Validates integrity and rejects duplicate IDs.
   */
  register(skill: Skill): void {
    const validation = this.validate(skill)
    if (!validation.valid) {
      throw new Error(`Cannot register invalid Skill "${skill.id}": ${validation.errors.join('; ')}`)
    }

    if (this.skills.has(skill.id)) {
      throw new Error(`Skill with ID "${skill.id}" is already registered. Duplicate IDs are rejected.`)
    }

    this.skills.set(skill.id, skill)

    // Register well-known canonical aliases
    if (skill.id === 'bulk-rename-files') {
      this.aliases.set('bulk-rename', skill.id)
    } else if (skill.id === 'duplicate-file-detection') {
      this.aliases.set('duplicate-detection', skill.id)
    }
  }

  /**
   * Register an alias for an existing Skill ID.
   */
  registerAlias(alias: string, targetSkillId: string): void {
    this.aliases.set(alias, targetSkillId)
  }

  /**
   * Unregister a Skill by ID.
   */
  unregister(skillId: string): boolean {
    return this.skills.delete(skillId)
  }

  /**
   * Retrieve a Skill by ID or alias.
   */
  get(skillId: string): Skill | undefined {
    return this.skills.get(skillId) ?? this.skills.get(this.aliases.get(skillId) ?? '')
  }

  /**
   * Check if a Skill ID or alias exists.
   */
  has(skillId: string): boolean {
    return this.skills.has(skillId) || (this.aliases.has(skillId) && this.skills.has(this.aliases.get(skillId)!))
  }

  /**
   * List registered Skills, optionally filtered by category.
   */
  list(category?: SkillCategory): Skill[] {
    const all = Array.from(this.skills.values())
    return category ? all.filter((s) => s.category === category) : all
  }

  /**
   * List immutable, serializable manifests of registered Skills.
   */
  listManifests(category?: SkillCategory): SkillManifest[] {
    return this.list(category).map((s) => toSkillManifest(s))
  }

  /**
   * Alias for listManifests.
   */
  getManifests(category?: SkillCategory): SkillManifest[] {
    return this.listManifests(category)
  }

  /**
   * Check availability of a skill against a capability provider predicate.
   */
  isAvailable(
    skillId: string,
    capabilityProvider: (cap: TaskCapability) => boolean,
    permissionProvider?: (perm: string) => boolean,
    platform: 'windows' | 'macos' | 'linux' = 'windows'
  ): SkillAvailability {
    const skill = this.get(skillId)
    if (!skill) {
      return {
        available: false,
        missingCapabilities: [],
        missingPermissions: [],
        unsupportedPlatform: false,
      }
    }

    const missingCapabilities = skill.requiredCapabilities.filter((cap) => !capabilityProvider(cap))
    const missingPermissions = (skill.requiredPermissions ?? []).filter((perm) =>
      permissionProvider ? !permissionProvider(perm) : false
    )
    const unsupportedPlatform = skill.supportedPlatforms
      ? !skill.supportedPlatforms.includes(platform)
      : false

    return {
      available: missingCapabilities.length === 0 && missingPermissions.length === 0 && !unsupportedPlatform,
      missingCapabilities,
      missingPermissions,
      unsupportedPlatform,
    }
  }

  /**
   * Resolve a Skill by ID and optional semver requirement.
   */
  resolve(skillId: string, version?: string): Skill | undefined {
    const skill = this.skills.get(skillId)
    if (!skill) return undefined

    if (version && skill.version !== version) {
      // Basic exact or prefix version check
      if (!skill.version.startsWith(version)) {
        return undefined
      }
    }

    return skill
  }

  /**
   * Validates a Skill definition against system invariants.
   */
  validate(skill: Skill): SkillValidationResult {
    const errors: string[] = []

    if (!skill.id || typeof skill.id !== 'string' || !/^[a-z0-9-_]+$/.test(skill.id)) {
      errors.push(`Invalid skill ID "${skill.id}". Must be non-empty kebab-case or alphanumeric.`)
    }

    if (!skill.name || typeof skill.name !== 'string') {
      errors.push('Skill name must be a non-empty string.')
    }

    if (!skill.version || !/^\d+\.\d+\.\d+/.test(skill.version)) {
      errors.push(`Invalid semver version "${skill.version}". Must match x.y.z.`)
    }

    if (!skill.requiredCapabilities || !Array.isArray(skill.requiredCapabilities) || skill.requiredCapabilities.length === 0) {
      errors.push('Skill must declare at least one required capability.')
    }

    if (!skill.workflowDefinition || typeof skill.workflowDefinition.generateTasks !== 'function') {
      errors.push('Skill must declare a valid workflowDefinition with a generateTasks function.')
    }

    if (!skill.inputs || typeof skill.inputs !== 'object') {
      errors.push('Skill must define an inputs specification.')
    }

    if (!skill.verificationDefinition || !Array.isArray(skill.verificationDefinition.conditions)) {
      errors.push('Skill must declare a valid verificationDefinition.')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Check if a Skill is available in the current environment.
   */
  checkAvailability(
    skillId: string,
    availableCapabilities: TaskCapability[] = [],
    grantedPermissions: string[] = [],
    platform: 'windows' | 'macos' | 'linux' = 'windows'
  ): SkillAvailability {
    const skill = this.get(skillId)
    if (!skill) {
      return {
        available: false,
        missingCapabilities: [],
        missingPermissions: [],
        unsupportedPlatform: false,
      }
    }

    const capSet = new Set(availableCapabilities)
    const permSet = new Set(grantedPermissions)

    const missingCapabilities = skill.requiredCapabilities.filter((cap) => !capSet.has(cap))
    const missingPermissions = (skill.requiredPermissions ?? []).filter((perm) => !permSet.has(perm))
    const unsupportedPlatform = skill.supportedPlatforms
      ? !skill.supportedPlatforms.includes(platform)
      : false

    const available =
      missingCapabilities.length === 0 &&
      missingPermissions.length === 0 &&
      !unsupportedPlatform

    return {
      available,
      missingCapabilities,
      missingPermissions,
      unsupportedPlatform,
    }
  }

  /**
   * Clear all registered skills (primarily for testing).
   */
  clear(): void {
    this.skills.clear()
  }
}
