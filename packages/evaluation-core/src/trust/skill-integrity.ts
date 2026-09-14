import { createHash } from 'node:crypto'

import type { SkillPackage, SkillPackageIntegrity } from '@usepilot/evaluation-types'

/**
 * SkillIntegrity — Cryptographic SHA-256 hashing and verification for Skill packages.
 *
 * Invariant: If a package or manifest is tampered with or corrupted after validation,
 * hash comparison will fail, instantly invalidating trust and rejecting execution.
 */
export class SkillIntegrity {
  /**
   * Compute deterministic SHA-256 hash of manifest structure.
   */
  static hashManifest(manifest: unknown): string {
    const serialized = JSON.stringify(manifest, Object.keys(manifest as object).sort())
    return createHash('sha256').update(serialized).digest('hex')
  }

  /**
   * Compute deterministic SHA-256 hash of entire package contents.
   */
  static hashPackageContent(pkg: Omit<SkillPackage, 'integrity'>): string {
    const normalized = {
      id: pkg.id,
      version: pkg.version,
      description: pkg.description,
      manifest: pkg.manifest,
      inputSchema: pkg.inputSchema,
      outputSchema: pkg.outputSchema,
      requiredCapabilities: [...pkg.requiredCapabilities].sort(),
      permissions: [...pkg.permissions].sort(),
      workflow: pkg.workflow,
      verification: pkg.verification,
      compatibility: pkg.compatibility,
      author: pkg.author,
      source: pkg.source,
      createdAt: pkg.createdAt,
    }
    const serialized = JSON.stringify(normalized)
    return createHash('sha256').update(serialized).digest('hex')
  }

  /**
   * Generate integrity metadata for a skill package.
   */
  static generateIntegrity(pkg: Omit<SkillPackage, 'integrity'>): SkillPackageIntegrity {
    return {
      manifestHash: this.hashManifest(pkg.manifest),
      contentHash: this.hashPackageContent(pkg),
      algorithm: 'sha256',
    }
  }

  /**
   * Verify package cryptographic integrity against declared hashes.
   */
  static verifyIntegrity(pkg: SkillPackage): { valid: boolean; error?: string } {
    const expectedManifestHash = this.hashManifest(pkg.manifest)
    if (pkg.integrity.manifestHash !== expectedManifestHash) {
      return {
        valid: false,
        error: `Manifest hash mismatch: expected ${expectedManifestHash}, found ${pkg.integrity.manifestHash}. Package manifest has been tampered with.`,
      }
    }

    const expectedContentHash = this.hashPackageContent(pkg)
    if (pkg.integrity.contentHash !== expectedContentHash) {
      return {
        valid: false,
        error: `Content hash mismatch: expected ${expectedContentHash}, found ${pkg.integrity.contentHash}. Package contents have been modified or corrupted.`,
      }
    }

    return { valid: true }
  }
}
