import type {
  SkillPackage,
  SkillPackageValidationResult,
} from '@usepilot/evaluation-types'

import { SkillIntegrity } from './skill-integrity'

const VALID_CAPABILITIES = new Set([
  'navigate_website',
  'download_file',
  'read_file',
  'write_file',
  'move_file',
  'delete_file',
  'search_web',
  'extract_web_data',
  'authenticate_user',
  'send_communication',
  'read_communication',
  'execute_command',
  'read_clipboard',
  'write_clipboard',
  'call_api',
  'transform_data',
  'verify_state',
  'none',
])

/**
 * SkillPackageValidator — Validates package manifest schemas, declared
 * capabilities, permission boundaries, and cryptographic integrity.
 *
 * Invariant: Invalid packages, packages requesting undeclared capabilities,
 * or packages with broken hashes are rejected immediately.
 */
export class SkillPackageValidator {
  validate(pkg: SkillPackage): SkillPackageValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 1. Basic field presence and formatting
    if (!pkg.id || typeof pkg.id !== 'string' || !/^[a-z0-9-_]+$/.test(pkg.id)) {
      errors.push('Package ID must be a non-empty alphanumeric string with dashes/underscores.')
    }

    if (!pkg.version || !/^\d+\.\d+\.\d+/.test(pkg.version)) {
      errors.push('Package version must follow semantic versioning (e.g. 1.0.0).')
    }

    if (!pkg.author) {
      warnings.push('Package author is missing or unspecified.')
    }

    // 2. Manifest check
    if (!pkg.manifest || pkg.manifest.id !== pkg.id) {
      errors.push('Package manifest ID does not match package ID.')
    }

    // 3. Capability validation against known runtime capabilities
    for (const cap of pkg.requiredCapabilities) {
      if (!VALID_CAPABILITIES.has(cap)) {
        errors.push(`Declared required capability "${cap}" is not a recognized system capability.`)
      }
    }

    // 4. Workflow definition check
    if (!pkg.workflow || typeof pkg.workflow.generateTasks !== 'function') {
      errors.push('Package must define a valid workflow task generator function.')
    }

    // 5. Verification definition check
    if (!pkg.verification || !pkg.verification.strategy) {
      errors.push('Package must declare a deterministic verification definition strategy.')
    }

    // 6. Cryptographic integrity check
    if (!pkg.integrity || !pkg.integrity.contentHash || !pkg.integrity.manifestHash) {
      errors.push('Package lacks cryptographic integrity hashes.')
    } else {
      const integrityCheck = SkillIntegrity.verifyIntegrity(pkg)
      if (!integrityCheck.valid) {
        errors.push(integrityCheck.error ?? 'Cryptographic integrity verification failed.')
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    }
  }
}
