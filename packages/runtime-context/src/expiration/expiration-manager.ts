import type { MemoryContextStore } from '../core/store'
import type { KnowledgeStore } from '../knowledge/knowledge-store'

export type RetentionTier = 'session' | 'daily' | 'weekly' | 'persistent' | 'manual'

export interface RetentionPolicyRule {
  tier: RetentionTier
  ttlSeconds?: number | undefined
}

export const DEFAULT_RETENTION_RULES: Record<RetentionTier, RetentionPolicyRule> = {
  session: { tier: 'session', ttlSeconds: 3600 }, // 1 hour or session close
  daily: { tier: 'daily', ttlSeconds: 86400 }, // 24 hours
  weekly: { tier: 'weekly', ttlSeconds: 604800 }, // 7 days
  persistent: { tier: 'persistent' },
  manual: { tier: 'manual' },
}

export class ContextExpirationManager {
  private contextStore: MemoryContextStore
  private knowledgeStore: KnowledgeStore
  private reaperInterval?: NodeJS.Timeout | undefined

  constructor(contextStore: MemoryContextStore, knowledgeStore: KnowledgeStore) {
    this.contextStore = contextStore
    this.knowledgeStore = knowledgeStore
  }

  startPeriodicReaper(intervalMs = 60000): void {
    if (this.reaperInterval) return
    this.reaperInterval = setInterval(() => {
      this.runReaper()
    }, intervalMs)
  }

  stopPeriodicReaper(): void {
    if (this.reaperInterval) {
      clearInterval(this.reaperInterval)
      this.reaperInterval = undefined
    }
  }

  runReaper(): { expiredCacheEntries: number } {
    const expiredCacheEntries = this.knowledgeStore.cleanExpired()
    return { expiredCacheEntries }
  }

  async expireSession(sessionId: string): Promise<void> {
    await this.contextStore.deleteSession(sessionId)
  }
}
