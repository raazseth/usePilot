import type {
  Skill,
  SkillResolution,
  MissingInputDetail,
  InvalidInputDetail,
  ResolutionContext,
} from '@usepilot/skill-types'
import { SkillParameterExtractor } from './parameter-extractor'

/**
 * SkillResolver — Validates and configures a Skill with provided inputs.
 *
 * Checks:
 * - required vs optional vs defaulted inputs
 * - schema validation via skill.inputSchema
 * - required capabilities against host runtime
 * - required permissions against granted scopes
 * - platform compatibility
 *
 * If required information is missing, returns structured missing-input details
 * rather than guessing or silently hallucinating parameters.
 */
export class SkillResolver {
  private readonly extractor = new SkillParameterExtractor()

  resolve(
    skill: Skill,
    rawInputs: Record<string, unknown> = {},
    context: ResolutionContext = {}
  ): SkillResolution {
    const { availableCapabilities, grantedPermissions, platform = 'windows' } = context

    const missingInputs: MissingInputDetail[] = []
    const invalidInputs: InvalidInputDetail[] = []
    const configuredInputs: Record<string, unknown> = this.extractor.extract(skill, rawInputs, context)

    // 1. Check Platform Support
    if (skill.supportedPlatforms && !skill.supportedPlatforms.includes(platform)) {
      return {
        success: false,
        skillId: skill.id,
        skillVersion: skill.version,
        status: 'unsupported_platform',
        configuredInputs: {},
        missingInputs: [],
        invalidInputs: [],
        missingCapabilities: [],
        missingPermissions: [],
        userPromptRequired: `Skill "${skill.name}" is not supported on ${platform}. Supported: ${skill.supportedPlatforms.join(', ')}`,
        skill,
      }
    }

    // 2. Check Required Capabilities
    const missingCapabilities = availableCapabilities
      ? skill.requiredCapabilities.filter((c) => !availableCapabilities.includes(c))
      : []

    if (missingCapabilities.length > 0) {
      return {
        success: false,
        skillId: skill.id,
        skillVersion: skill.version,
        status: 'unavailable_capabilities',
        configuredInputs: {},
        missingInputs: [],
        invalidInputs: [],
        missingCapabilities,
        missingPermissions: [],
        userPromptRequired: `Skill "${skill.name}" requires unavailable capabilities: ${missingCapabilities.join(', ')}`,
        skill,
      }
    }

    // 3. Check Required Permissions
    const missingPermissions = grantedPermissions
      ? (skill.requiredPermissions ?? []).filter((p) => !grantedPermissions.includes(p))
      : []

    if (missingPermissions.length > 0) {
      return {
        success: false,
        skillId: skill.id,
        skillVersion: skill.version,
        status: 'permission_denied',
        configuredInputs: {},
        missingInputs: [],
        invalidInputs: [],
        missingCapabilities: [],
        missingPermissions,
        userPromptRequired: `Skill "${skill.name}" requires permissions: ${missingPermissions.join(', ')}`,
        skill,
      }
    }

    // 4. Verify & Apply Inputs
    for (const [key, field] of Object.entries(skill.inputs)) {
      const val = configuredInputs[key]

      if (val === undefined || val === null || val === '') {
        if (field.default !== undefined) {
          configuredInputs[key] = field.default
        } else if (field.required) {
          missingInputs.push({
            name: key,
            description: field.description,
            type: field.type,
            promptQuestion: field.promptQuestion ?? `Which ${field.description.toLowerCase()} should I use?`,
            examples: field.examples,
          })
        }
      }
    }

    if (missingInputs.length > 0) {
      const firstMissing = missingInputs[0]!
      const userPromptRequired = missingInputs.length === 1
        ? `I need one thing: ${firstMissing.promptQuestion}`
        : `I need the following information to proceed:\n${missingInputs.map((m) => `• ${m.promptQuestion}`).join('\n')}`

      return {
        success: false,
        skillId: skill.id,
        skillVersion: skill.version,
        status: 'missing_input',
        configuredInputs,
        missingInputs,
        invalidInputs: [],
        missingCapabilities: [],
        missingPermissions: [],
        userPromptRequired,
        skill,
      }
    }

    // 5. Validate Schema via Zod
    const parseResult = skill.inputSchema.safeParse(configuredInputs)
    if (!parseResult.success) {
      for (const issue of parseResult.error.issues) {
        const fieldName = issue.path.join('.') || 'input'
        invalidInputs.push({
          name: fieldName,
          reason: issue.message,
          value: configuredInputs[fieldName],
        })
      }

      return {
        success: false,
        skillId: skill.id,
        skillVersion: skill.version,
        status: 'invalid_input',
        configuredInputs,
        missingInputs: [],
        invalidInputs,
        missingCapabilities: [],
        missingPermissions: [],
        userPromptRequired: `Invalid input for ${invalidInputs.map((i) => `${i.name} (${i.reason})`).join(', ')}`,
        skill,
      }
    }

    // All inputs valid and verified
    return {
      success: true,
      skillId: skill.id,
      skillVersion: skill.version,
      status: 'ready',
      configuredInputs: parseResult.data,
      missingInputs: [],
      invalidInputs: [],
      missingCapabilities: [],
      missingPermissions: [],
      skill,
    }
  }
}
