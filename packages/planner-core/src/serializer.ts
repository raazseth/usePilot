// ─────────────────────────────────────────────────────────────────────────────
// PlanSerializer
// Converts an ExecutionBlueprint to/from JSON.
// Computes a stable SHA-256 content hash for deduplication and versioning.
// ─────────────────────────────────────────────────────────────────────────────

import type { ExecutionBlueprint } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'
import { PlannerError, PlannerErrorCode } from './errors'

/**
 * The canonical fields used to compute the content hash.
 * Excluded: id, hash, version, createdAt (volatile metadata).
 */
function toHashableObject(blueprint: ExecutionBlueprint): object {
  return {
    goal: {
      primaryObjective: blueprint.goal.primaryObjective,
      expectedOutcome: blueprint.goal.expectedOutcome,
      constraints: [...blueprint.goal.constraints].sort(),
    },
    tasks: blueprint.tasks
      .map((t) => ({
        title: t.title,
        requiredTool: t.requiredTool,
        category: t.category,
        dependsOn: [...t.dependsOn].sort(),
        approvalPolicy: t.approvalPolicy,
      }))
      .sort((a, b) => a.title.localeCompare(b.title)),
  }
}

async function sha256(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    // Browser / Bun Web Crypto
    const encoder = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Fallback: simple deterministic hash (not cryptographic — for environments without crypto)
  let h = 5381
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) + h) ^ (data.charCodeAt(i) ?? 0)
    h = h >>> 0 // Convert to unsigned 32-bit integer
  }
  return h.toString(16).padStart(8, '0')
}

export class PlanSerializer {
  async computeHash(blueprint: ExecutionBlueprint): Promise<string> {
    const canonical = JSON.stringify(toHashableObject(blueprint))
    return sha256(canonical)
  }

  async serialize(blueprint: ExecutionBlueprint, version: number): Promise<ExecutionBlueprint> {
    try {
      const withId = { ...blueprint, id: blueprint.id || generateId(), version }
      const hash = await this.computeHash(withId)
      return { ...withId, hash }
    } catch (err) {
      throw new PlannerError({
        message: `Failed to serialize blueprint: ${err instanceof Error ? err.message : String(err)}`,
        code: PlannerErrorCode.SerializationFailed,
        stage: 'serializing',
        cause: err,
      })
    }
  }

  deserialize(json: string): ExecutionBlueprint {
    try {
      return JSON.parse(json) as ExecutionBlueprint
    } catch (err) {
      throw new PlannerError({
        message: `Failed to deserialize blueprint: ${err instanceof Error ? err.message : String(err)}`,
        code: PlannerErrorCode.SerializationFailed,
        stage: 'serializing',
        cause: err,
      })
    }
  }
}
