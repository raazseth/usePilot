import type { ContextProvenance } from '../core/provenance'

export interface ExecutionMemoryRecord {
  id: string
  executionId: string
  blueprintId: string
  intent: string
  capabilitySequence: string[]
  domainTargets: string[]
  success: boolean
  failureReason?: string | undefined
  durationMs: number
  approvalCount: number
  verificationPassed: boolean
  healingEventCount: number
  artifactsProducedCount: number
  provenance: ContextProvenance
  timestamp: number
  tags: string[]
}

export interface ExecutionMemoryQuery {
  intent?: string | undefined
  domain?: string | undefined
  capability?: string | undefined
  successOnly?: boolean | undefined
  limit?: number | undefined
}
