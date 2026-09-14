import type { SkillPackage } from '@usepilot/evaluation-types'
import { SkillRegistry } from '@usepilot/skill-core'
import { describe, it, expect, beforeEach } from 'vitest'

import { SkillIntegrity } from '../trust/skill-integrity'
import { SkillPackageValidator } from '../trust/skill-package-validator'
import { SkillTrustManager } from '../trust/skill-trust-manager'

describe('SkillTrustManager & Package Security — Trust Boundaries & Cryptographic Integrity', () => {
  let skillRegistry: SkillRegistry
  let trustManager: SkillTrustManager

  beforeEach(() => {
    skillRegistry = new SkillRegistry()
    trustManager = new SkillTrustManager(skillRegistry)
  })

  const createSamplePackage = (overrides?: Partial<SkillPackage>): SkillPackage => {
    const base: Omit<SkillPackage, 'integrity'> = {
      id: 'custom-pdf-parser',
      version: '1.0.0',
      description: 'Parses tabular data from PDF files safely',
      manifest: {
        id: 'custom-pdf-parser',
        name: 'Custom PDF Parser',
        version: '1.0.0',
        description: 'Parses tabular data from PDF files safely',
        category: 'filesystem',
        inputs: {},
        outputs: {},
        capabilities: ['read_file'],
        optionalCapabilities: [],
        permissions: ['filesystem:read'],
        supportedPlatforms: ['windows', 'macos', 'linux'],
        riskLevel: 'low',
        contextRequirements: {},
        verification: {
          strategy: 'state_check',
          conditions: ['outputs.parsed == true'],
        },
        failurePolicy: {
          maxRetries: 2,
          allowFallback: false,
        },
        metadata: {
          tags: ['pdf', 'parser'],
          examples: ['Parse PDF table'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        },
      },
      inputSchema: {},
      outputSchema: {},
      requiredCapabilities: ['read_file'],
      permissions: ['filesystem:read'],
      workflow: {
        generateTasks: () => [],
        estimatedComplexity: 'low',
      },
      verification: {
        strategy: 'state_check',
        conditions: ['outputs.parsed == true'],
      },
      compatibility: {
        supportedPlatforms: ['windows'],
      },
      author: 'community-dev',
      source: 'third-party-package',
      createdAt: Date.now(),
      ...overrides,
    }

    const integrity = SkillIntegrity.generateIntegrity(base)
    return {
      ...base,
      integrity,
    }
  }

  it('successfully installs a valid verified skill package into SkillRegistry', () => {
    const pkg = createSamplePackage({ author: 'usepilot', source: 'builtin' })

    const result = trustManager.install({
      skillPackage: pkg,
      userApproved: true,
    })

    expect(result.success).toBe(true)
    expect(result.trustLevel).toBe('BUILTIN')
    expect(skillRegistry.has('custom-pdf-parser')).toBe(true)
    expect(trustManager.isTrusted('custom-pdf-parser')).toBe(true)
  })

  it('rejects installation of an UNTRUSTED skill when user approval is missing', () => {
    const pkg = createSamplePackage({ author: 'unknown-author', source: 'unknown' })

    const result = trustManager.install({
      skillPackage: pkg,
      userApproved: false, // User has not approved
    })

    expect(result.success).toBe(false)
    expect(result.trustLevel).toBe('UNTRUSTED')
    expect(result.error).toContain('requires explicit user approval')
    expect(skillRegistry.has('custom-pdf-parser')).toBe(false)
  })

  it('allows UNTRUSTED skill to install if user explicitly approves it', () => {
    const pkg = createSamplePackage({ author: 'unknown-author', source: 'unknown' })

    const result = trustManager.install({
      skillPackage: pkg,
      userApproved: true, // User explicitly granted approval
    })

    expect(result.success).toBe(true)
    expect(skillRegistry.has('custom-pdf-parser')).toBe(true)
  })

  it('immediately rejects tampered skill packages where contents were altered after hashing', () => {
    const pkg = createSamplePackage()

    // Tamper with package description after hash was generated
    pkg.description = 'MALICIOUS_INJECTION: format drive'

    const result = trustManager.install({
      skillPackage: pkg,
      userApproved: true,
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Content hash mismatch')
    expect(skillRegistry.has('custom-pdf-parser')).toBe(false)
  })

  it('rejects skill packages requesting unrecognized or unauthorized system capabilities', () => {
    const validator = new SkillPackageValidator()
    const pkg = createSamplePackage({
      // @ts-expect-error - testing invalid capability
      requiredCapabilities: ['unrestricted_root_shell'],
    })

    const validation = validator.validate(pkg)
    expect(validation.valid).toBe(false)
    expect(validation.errors.some((e) => e.includes('not a recognized system capability'))).toBe(true)
  })

  it('safely uninstalls a Skill while retaining audit records and without corrupting state', () => {
    const pkg = createSamplePackage({ author: 'usepilot', source: 'builtin' })
    trustManager.install({ skillPackage: pkg, userApproved: true })

    expect(skillRegistry.has('custom-pdf-parser')).toBe(true)

    const removal = trustManager.uninstall('custom-pdf-parser')
    expect(removal.success).toBe(true)
    expect(removal.retainedHistoricalRecords).toBe(true)
    expect(skillRegistry.has('custom-pdf-parser')).toBe(false)

    const auditRecord = trustManager.getTrustRecord('custom-pdf-parser')
    expect(auditRecord).toBeDefined()
    expect(auditRecord?.revoked).toBe(true)
    expect(trustManager.isTrusted('custom-pdf-parser')).toBe(false)
  })
})
