import type {
  SkillInstallRequest,
  SkillInstallResult,
  SkillRemovalResult,
  SkillTrustLevel,
  SkillTrustRecord,
} from '@usepilot/evaluation-types'
import type { SkillRegistry } from '@usepilot/skill-core'
import type { Skill } from '@usepilot/skill-types'
import { z } from 'zod'

import { SkillIntegrity } from './skill-integrity'
import { SkillPackageValidator } from './skill-package-validator'

/**
 * SkillTrustManager — Governs skill package trust tiers, installation,
 * verification, and safe lifecycle integration with the single authoritative SkillRegistry.
 *
 * Trust Tiers:
 * - BUILTIN: Official core usePilot skills.
 * - USER: Locally authored or imported by the user.
 * - VERIFIED: Third-party skills audited and verified against usePilot contracts.
 * - UNTRUSTED: Unknown skills. Cannot execute without explicit user approval.
 *
 * Invariant: Capabilities declared by packages are requests, not authorization.
 * Execution authority remains enforced by Capability Registry and Permission Manager.
 */
export class SkillTrustManager {
  private readonly trustRecords = new Map<string, SkillTrustRecord>()
  private readonly validator: SkillPackageValidator

  constructor(
    private readonly skillRegistry: SkillRegistry,
    validator?: SkillPackageValidator
  ) {
    this.validator = validator ?? new SkillPackageValidator()
  }

  install(request: SkillInstallRequest): SkillInstallResult {
    const pkg = request.skillPackage

    // 1. Validate package structure and schemas
    const validation = this.validator.validate(pkg)
    if (!validation.valid) {
      return {
        success: false,
        skillId: pkg.id,
        version: pkg.version,
        trustLevel: 'UNTRUSTED',
        error: `Package validation failed: ${validation.errors.join('; ')}`,
      }
    }

    // 2. Cryptographic integrity verification
    const integrityCheck = SkillIntegrity.verifyIntegrity(pkg)
    if (!integrityCheck.valid) {
      return {
        success: false,
        skillId: pkg.id,
        version: pkg.version,
        trustLevel: 'UNTRUSTED',
        error: integrityCheck.error,
      }
    }

    // 3. Determine trust tier
    let trustLevel: SkillTrustLevel = request.targetTrustLevel ?? 'UNTRUSTED'
    if (pkg.author === 'usepilot' || pkg.source === 'builtin') {
      trustLevel = 'BUILTIN'
    } else if (request.targetTrustLevel === 'VERIFIED') {
      trustLevel = 'VERIFIED'
    } else if (request.targetTrustLevel === 'USER') {
      trustLevel = 'USER'
    }

    // 4. Untrusted boundary: require explicit user approval
    if (trustLevel === 'UNTRUSTED' && !request.userApproved) {
      return {
        success: false,
        skillId: pkg.id,
        version: pkg.version,
        trustLevel: 'UNTRUSTED',
        error: `Installation blocked: untrusted skill "${pkg.id}" requires explicit user approval.`,
      }
    }

    // 5. Convert to executable Skill definition
    const skill: Skill = {
      id: pkg.id,
      name: pkg.manifest.name,
      description: pkg.description,
      version: pkg.version,
      category: pkg.manifest.category,
      inputs: pkg.manifest.inputs,
      inputSchema: z.record(z.unknown()),
      outputs: pkg.manifest.outputs,
      outputSchema: z.record(z.unknown()),
      requiredCapabilities: pkg.requiredCapabilities,
      requiredPermissions: pkg.permissions,
      supportedPlatforms: (pkg.compatibility.supportedPlatforms as ('windows' | 'macos' | 'linux')[]) ?? ['windows'],
      riskLevel: pkg.manifest.riskLevel,
      workflowDefinition: pkg.workflow,
      verificationDefinition: pkg.verification,
      failurePolicy: {
        maxRetries: 2,
        allowFallback: false,
      },
      contextRequirements: pkg.manifest.contextRequirements,
      metadata: {
        author: pkg.author,
        tags: pkg.manifest.metadata?.tags ?? [],
        examples: pkg.manifest.metadata?.examples ?? [],
        category: pkg.manifest.category,
        createdAt: pkg.createdAt,
        updatedAt: Date.now(),
      },
    }

    // 6. Register into authoritative SkillRegistry
    try {
      this.skillRegistry.register(skill)
    } catch (err) {
      return {
        success: false,
        skillId: pkg.id,
        version: pkg.version,
        trustLevel,
        error: (err as Error).message,
      }
    }

    // 7. Store trust record
    const record: SkillTrustRecord = {
      skillId: pkg.id,
      version: pkg.version,
      trustLevel,
      approvedByUser: request.userApproved || trustLevel === 'BUILTIN',
      contentHash: pkg.integrity.contentHash,
      manifestHash: pkg.integrity.manifestHash,
      installedAt: Date.now(),
      lastVerifiedAt: Date.now(),
      revoked: false,
    }
    this.trustRecords.set(pkg.id, record)

    return {
      success: true,
      skillId: pkg.id,
      version: pkg.version,
      trustLevel,
    }
  }

  uninstall(skillId: string): SkillRemovalResult {
    const record = this.trustRecords.get(skillId)

    if (this.skillRegistry.has(skillId)) {
      this.skillRegistry.unregister(skillId)
    }

    if (record) {
      record.revoked = true
      record.revocationReason = 'Uninstalled by user'
      this.trustRecords.set(skillId, record)
    }

    return {
      success: true,
      skillId,
      retainedHistoricalRecords: true,
    }
  }

  getTrustRecord(skillId: string): SkillTrustRecord | undefined {
    return this.trustRecords.get(skillId)
  }

  isTrusted(skillId: string): boolean {
    const record = this.trustRecords.get(skillId)
    if (!record || record.revoked) return false
    return record.trustLevel === 'BUILTIN' || record.trustLevel === 'VERIFIED' || (record.trustLevel === 'USER' && record.approvedByUser)
  }

  listRecords(): SkillTrustRecord[] {
    return Array.from(this.trustRecords.values())
  }
}
