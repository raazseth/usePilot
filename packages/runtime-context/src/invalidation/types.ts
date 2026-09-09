export type InvalidationReason =
  | 'user_logout'
  | 'website_redesign'
  | 'file_deleted'
  | 'window_closed'
  | 'permission_revoked'
  | 'manual'

export type InvalidationScope =
  | 'browser'
  | 'observations'
  | 'index'
  | 'entities'
  | 'all'

export interface InvalidationEvent {
  id: string
  timestamp: number
  reason: InvalidationReason
  scope: InvalidationScope
  target?: string | undefined // Domain, file path, entityId, etc.
  invalidatedCount: {
    observations: number
    indexDocuments: number
    graphNodes: number
    entities: number
    relationships: number
  }
  metadata?: Record<string, unknown> | undefined
}

export type InvalidationSubscriber = (event: InvalidationEvent) => void

export interface InvalidationOptions {
  target?: string | undefined
  metadata?: Record<string, unknown> | undefined
}
