// ManifestGenerator — generates immutable, verifiable execution manifests

import { generateId } from '@usepilot/utils'
import type {
  ExecutionManifest,
  ExecutionPolicy,
  SelectedAdapterRecord,
} from '@usepilot/execution-types'

async function computeSha256(data: string): Promise<string> {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoder = new TextEncoder()
    const hash = await crypto.subtle.digest('SHA-256', encoder.encode(data))
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  // Fallback deterministic 64-char hex string
  let h = 5381
  for (let i = 0; i < data.length; i++) {
    h = ((h << 5) + h) ^ (data.charCodeAt(i) ?? 0)
    h = h >>> 0
  }
  return h.toString(16).padStart(64, '0')
}

export interface GenerateManifestInput {
  runId: string
  traceId: string
  blueprintHash: string
  plannerVersion?: string | undefined
  executionVersion?: string | undefined
  policy: ExecutionPolicy
  capabilities: string[]
  selectedAdapters: SelectedAdapterRecord[]
  environment: {
    os: string
    arch: string
    runtime: string
    nodeVersion?: string | undefined
  }
  startedAt: number
  completedAt: number
  tasksSummary: {
    total: number
    completed: number
    failed: number
    skipped: number
  }
  outcome: 'success' | 'failed' | 'cancelled'
}

export class ManifestGenerator {
  static async generate(input: GenerateManifestInput): Promise<ExecutionManifest> {
    const manifestId = generateId()
    const durationMs = Math.max(0, input.completedAt - input.startedAt)

    const hashableData = {
      runId: input.runId,
      traceId: input.traceId,
      blueprintHash: input.blueprintHash,
      plannerVersion: input.plannerVersion ?? '0.2.0',
      executionVersion: input.executionVersion ?? '0.3.0',
      policy: input.policy,
      capabilities: [...input.capabilities].sort(),
      selectedAdapters: input.selectedAdapters,
      environment: input.environment,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      durationMs,
      tasksSummary: input.tasksSummary,
      outcome: input.outcome,
    }

    const canonicalJson = JSON.stringify(hashableData)
    const manifestHash = await computeSha256(canonicalJson)

    return {
      manifestId,
      ...hashableData,
      manifestHash,
    }
  }
}
