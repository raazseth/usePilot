import type { ContextProvenance } from '../core/provenance'

export type KnowledgeCategory =
  | 'cache'
  | 'persistent'
  | 'browser_graph'
  | 'document'
  | 'ocr'
  | 'semantic_fact'

export type KnowledgeRetentionPolicy =
  | 'session'
  | 'temporary'
  | 'persistent'
  | 'pinned'

export interface KnowledgeItem<T = unknown> {
  id: string
  key: string
  category: KnowledgeCategory
  policy: KnowledgeRetentionPolicy
  data: T
  provenance: ContextProvenance
  version: number
  expiresAt?: number | undefined
  createdAt: number
  updatedAt: number
}

export interface FormFieldDescriptor {
  name: string
  type?: string | undefined
  label?: string | undefined
  required?: boolean | undefined
  selector?: string | undefined
  action?: string | undefined
  inputs?: Array<{ name: string; type?: string; required?: boolean; selector?: string }> | undefined
}

export interface PageActionDescriptor {
  actionId: string
  name: string
  description?: string | undefined
  targetSelector: string
  actionType: 'click' | 'input' | 'submit' | 'download' | 'navigate'
}

export interface BrowserPageNode {
  path: string
  url: string
  title: string
  parentPath?: string | undefined
  forms: FormFieldDescriptor[]
  actions: PageActionDescriptor[]
  requiresAuth?: boolean | undefined
  lastVisited: number
  visitCount: number
}

export interface DomainKnowledgeGraph {
  domain: string
  rootUrl: string
  graphVersion: number
  confidence: number // 0.0 to 1.0
  fingerprint: string
  lastVerified: number
  nodes: Record<string, BrowserPageNode>
  authenticated: boolean
  discoveredAt: number
  updatedAt: number
}
