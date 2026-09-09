import { createProvenance } from '../core/provenance'
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
    provenance?: ContextProvenance
  ): BrowserPageNode {
    const now = Date.now()
    let graph = this.domains.get(domain)
    if (!graph) {
      graph = {
        domain,
        rootUrl: `https://${domain}`,
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
    graph.updatedAt = now

    // Keep track of provenance if provided
    if (provenance) {
      // Attached in knowledge layer
    }

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
    graph.updatedAt = Date.now()
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
    graph.updatedAt = Date.now()
    return true
  }

  setAuthentication(domain: string, authenticated: boolean): void {
    const graph = this.domains.get(domain)
    if (graph) {
      graph.authenticated = authenticated
      graph.updatedAt = Date.now()
    }
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
}
