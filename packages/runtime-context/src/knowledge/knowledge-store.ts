import { BrowserKnowledgeGraph } from './browser-graph'
import type { ContextProvenance } from '../core/provenance'
import type {
  KnowledgeItem,
  KnowledgeCategory,
  KnowledgeRetentionPolicy,
} from './types'

export interface KnowledgeStoreOptions {
  maxCacheEntries?: number | undefined
}

export class KnowledgeStore {
  private static instance: KnowledgeStore | null = null
  private items = new Map<string, KnowledgeItem>()
  private browserGraph: BrowserKnowledgeGraph
  private maxCacheEntries: number

  constructor(options?: KnowledgeStoreOptions) {
    this.maxCacheEntries = options?.maxCacheEntries ?? 1000
    this.browserGraph = new BrowserKnowledgeGraph()
  }

  static getInstance(): KnowledgeStore {
    if (!KnowledgeStore.instance) {
      KnowledgeStore.instance = new KnowledgeStore()
    }
    return KnowledgeStore.instance
  }

  getBrowserGraph(): BrowserKnowledgeGraph {
    return this.browserGraph
  }

  // 1. Cache Layer
  setCache<T>(
    key: string,
    data: T,
    provenance: ContextProvenance,
    ttlSeconds = 300
  ): KnowledgeItem<T> {
    const item = this.putItem(key, 'cache', 'temporary', data, provenance, ttlSeconds)
    this.pruneCache()
    return item
  }

  getCache<T>(key: string): T | undefined {
    const item = this.items.get(`cache:${key}`)
    if (!item) return undefined
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.items.delete(`cache:${key}`)
      return undefined
    }
    return item.data as T
  }

  // 2. Persistent Knowledge
  setPersistent<T>(
    key: string,
    data: T,
    provenance: ContextProvenance
  ): KnowledgeItem<T> {
    return this.putItem(key, 'persistent', 'persistent', data, provenance)
  }

  getPersistent<T>(key: string): T | undefined {
    const item = this.items.get(`persistent:${key}`)
    return item ? (item.data as T) : undefined
  }

  // 3. Documents
  storeDocument<T>(
    docId: string,
    data: T,
    provenance: ContextProvenance,
    policy: KnowledgeRetentionPolicy = 'persistent'
  ): KnowledgeItem<T> {
    return this.putItem(docId, 'document', policy, data, provenance)
  }

  getDocument<T>(docId: string): T | undefined {
    const item = this.items.get(`document:${docId}`)
    return item ? (item.data as T) : undefined
  }

  // 4. OCR
  storeOcr<T>(
    imageHash: string,
    ocrData: T,
    provenance: ContextProvenance
  ): KnowledgeItem<T> {
    return this.putItem(imageHash, 'ocr', 'persistent', ocrData, provenance)
  }

  getOcr<T>(imageHash: string): T | undefined {
    const item = this.items.get(`ocr:${imageHash}`)
    return item ? (item.data as T) : undefined
  }

  private putItem<T>(
    key: string,
    category: KnowledgeCategory,
    policy: KnowledgeRetentionPolicy,
    data: T,
    provenance: ContextProvenance,
    ttlSeconds?: number
  ): KnowledgeItem<T> {
    const now = Date.now()
    const compoundKey = `${category}:${key}`
    const existing = this.items.get(compoundKey)

    const item: KnowledgeItem<T> = {
      id: `k-${category}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      key,
      category,
      policy,
      data,
      provenance,
      version: (existing?.version ?? 0) + 1,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }

    if (ttlSeconds && ttlSeconds > 0) {
      item.expiresAt = now + ttlSeconds * 1000
    }

    this.items.set(compoundKey, item as KnowledgeItem)
    return item
  }

  getItem(compoundKey: string): KnowledgeItem | undefined {
    const item = this.items.get(compoundKey)
    if (!item) return undefined
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.items.delete(compoundKey)
      return undefined
    }
    return item
  }

  listByCategory(category: KnowledgeCategory): KnowledgeItem[] {
    const now = Date.now()
    const result: KnowledgeItem[] = []
    for (const [k, item] of this.items.entries()) {
      if (item.category === category) {
        if (item.expiresAt && now > item.expiresAt) {
          this.items.delete(k)
        } else {
          result.push(item)
        }
      }
    }
    return result
  }

  invalidate(category: KnowledgeCategory, key: string): boolean {
    return this.items.delete(`${category}:${key}`)
  }

  cleanExpired(): number {
    const now = Date.now()
    let removed = 0
    for (const [k, item] of this.items.entries()) {
      if (item.expiresAt && now > item.expiresAt) {
        this.items.delete(k)
        removed++
      }
    }
    return removed
  }

  private pruneCache(): void {
    const cacheKeys: string[] = []
    for (const [k, item] of this.items.entries()) {
      if (item.category === 'cache' && item.policy !== 'pinned') {
        cacheKeys.push(k)
      }
    }
    if (cacheKeys.length > this.maxCacheEntries) {
      const excess = cacheKeys.length - this.maxCacheEntries
      for (let i = 0; i < excess; i++) {
        const toRemove = cacheKeys[i]
        if (toRemove) this.items.delete(toRemove)
      }
    }
  }

  getTotalCount(): number {
    return this.items.size
  }
}
