// Context Provenance — Tracks origin, confidence, and audit trail for all runtime knowledge

export type ProvenanceSource =
  | 'browser'
  | 'filesystem'
  | 'desktop'
  | 'vision'
  | 'execution'
  | 'user'
  | 'planner'
  | 'mcp'
  | 'system'

export interface ContextProvenance {
  source: ProvenanceSource
  timestamp: number
  confidence: number // 0.0 to 1.0
  adapter?: string | undefined
  executionId?: string | undefined
  taskId?: string | undefined
  url?: string | undefined
  path?: string | undefined
  metadata?: Record<string, unknown> | undefined
}

export function createProvenance(
  source: ProvenanceSource,
  options?: Partial<Omit<ContextProvenance, 'source' | 'timestamp'>> & { timestamp?: number }
): ContextProvenance {
  const confidence = typeof options?.confidence === 'number'
    ? Math.max(0, Math.min(1, options.confidence))
    : 1.0

  const prov: ContextProvenance = {
    source,
    timestamp: options?.timestamp ?? Date.now(),
    confidence,
  }

  if (options?.adapter !== undefined) prov.adapter = options.adapter
  if (options?.executionId !== undefined) prov.executionId = options.executionId
  if (options?.taskId !== undefined) prov.taskId = options.taskId
  if (options?.url !== undefined) prov.url = options.url
  if (options?.path !== undefined) prov.path = options.path
  if (options?.metadata !== undefined) prov.metadata = options.metadata

  return prov
}
