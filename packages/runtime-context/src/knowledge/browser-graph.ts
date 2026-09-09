import { createHash } from 'node:crypto'

import type { ContextProvenance } from '../core/provenance'
import type {
  BrowserPageNode,
  DomainKnowledgeGraph,
  FormFieldDescriptor,
  PageActionDescriptor,
} from './types'

export class BrowserKnowledgeGraph {
  private domains = new Map<string, DomainKnowledgeGraph>()

  recordPage(
    domain: string,
    page: Omit<BrowserPageNode, 'lastVisited' | 'visitCount'>,
    _provenance?: ContextProvenance
  ): BrowserPageNode {
    const now = Date.now()
    let graph = this.domains.get(domain)
    if (!graph) {
      graph = {
        domain,
        rootUrl: `https://${domain}`,
        graphVersion: 1,
        confidence: 1.0,
        fingerprint: 'init',
        lastVerified: now,
        nodes: {},
        authenticated: false,
        discoveredAt: now,
        updatedAt: now,
      }
      this.domains.set(domain, graph)
    }

    const existing = graph.nodes[page.path]
    const updatedNode: BrowserPageNode = {
      ...page,
      lastVisited: now,
      visitCount: (existing?.visitCount ?? 0) + 1,
    }

    graph.nodes[page.path] = updatedNode
    graph.graphVersion += 1
    graph.updatedAt = now
    graph.fingerprint = this.computeFingerprint(graph)

    return updatedNode
  }

  recordForm(domain: string, path: string, form: FormFieldDescriptor): boolean {
    const graph = this.domains.get(domain)
    if (!graph) return false
    const node = graph.nodes[path]
    if (!node) return false

    const existingIndex = node.forms.findIndex((f) => f.name === form.name)
    if (existingIndex >= 0) {
      node.forms[existingIndex] = form
    } else {
      node.forms.push(form)
    }
    graph.graphVersion += 1
    graph.updatedAt = Date.now()
    graph.fingerprint = this.computeFingerprint(graph)
    return true
  }

  recordAction(domain: string, path: string, action: PageActionDescriptor): boolean {
    const graph = this.domains.get(domain)
    if (!graph) return false
    const node = graph.nodes[path]
    if (!node) return false

    const existingIndex = node.actions.findIndex((a) => a.actionId === action.actionId)
    if (existingIndex >= 0) {
      node.actions[existingIndex] = action
    } else {
      node.actions.push(action)
    }
    graph.graphVersion += 1
    graph.updatedAt = Date.now()
    graph.fingerprint = this.computeFingerprint(graph)
    return true
  }

  setAuthentication(domain: string, authenticated: boolean): void {
    const graph = this.domains.get(domain)
    if (graph) {
      graph.authenticated = authenticated
      graph.graphVersion += 1
      graph.updatedAt = Date.now()
    }
  }

  verifyGraph(domain: string, verifiedFingerprint?: string, confidence = 1.0): boolean {
    const graph = this.domains.get(domain)
    if (!graph) return false

    const now = Date.now()
    graph.lastVerified = now
    graph.confidence = Math.max(0, Math.min(1, confidence))

    if (verifiedFingerprint && verifiedFingerprint !== graph.fingerprint) {
      // Fingerprint mismatch indicates page topology changed
      graph.confidence = Math.min(graph.confidence, 0.5)
      graph.updatedAt = now
      return false
    }

    graph.updatedAt = now
    return true
  }

  isStale(domain: string, maxAgeMs = 86400000): boolean {
    const graph = this.domains.get(domain)
    if (!graph) return true
    const age = Date.now() - graph.lastVerified
    return age > maxAgeMs || graph.confidence < 0.7
  }

  getDomainGraph(domain: string): DomainKnowledgeGraph | undefined {
    return this.domains.get(domain)
  }

  getPageNode(domain: string, path: string): BrowserPageNode | undefined {
    return this.domains.get(domain)?.nodes[path]
  }

  listDomains(): string[] {
    return Array.from(this.domains.keys())
  }

  invalidateDomain(domain: string): boolean {
    return this.domains.delete(domain)
  }

  invalidatePage(domain: string, path: string): boolean {
    const graph = this.domains.get(domain)
    if (!graph || !graph.nodes[path]) return false
    delete graph.nodes[path]
    graph.graphVersion += 1
    graph.updatedAt = Date.now()
    graph.fingerprint = this.computeFingerprint(graph)
    return true
  }

  exportAll(): Record<string, DomainKnowledgeGraph> {
    const result: Record<string, DomainKnowledgeGraph> = {}
    for (const [d, g] of this.domains.entries()) {
      result[d] = g
    }
    return result
  }

  importAll(data: Record<string, DomainKnowledgeGraph>): void {
    for (const [d, g] of Object.entries(data)) {
      this.domains.set(d, g)
    }
  }

  private computeFingerprint(graph: DomainKnowledgeGraph): string {
    const keys = Object.keys(graph.nodes).sort()
    const content = keys
      .map((k) => {
        const n = graph.nodes[k]
        const formNames = n?.forms.map((f) => f.name).sort().join(',') ?? ''
        const actionIds = n?.actions.map((a) => a.actionId).sort().join(',') ?? ''
        return `${k}[${formNames}][${actionIds}]`
      })
      .join('|')

    return createHash('sha256').update(content).digest('hex').slice(0, 16)
  }
}
