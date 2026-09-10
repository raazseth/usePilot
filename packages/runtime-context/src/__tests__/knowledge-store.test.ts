import { describe, it, expect } from 'vitest'

import { createProvenance } from '../core/provenance'
import { KnowledgeStore } from '../knowledge/knowledge-store'

describe('KnowledgeStore & Browser Knowledge Graph', () => {
  it('KnowledgeStore manages Cache layer, Persistent knowledge, and Documents', () => {
    const store = new KnowledgeStore({ maxCacheEntries: 5 })
    const prov = createProvenance('planner', { confidence: 0.9 })

    // 1. Cache Layer with TTL
    store.setCache('temp-nav', { lastTarget: '#orders' }, prov, 10)
    const cached = store.getCache<{ lastTarget: string }>('temp-nav')
    expect(cached?.lastTarget).toBe('#orders')

    // 2. Persistent Knowledge
    store.setPersistent('amazon.in:login-selector', '#nav-link-accountList', prov)
    const persistent = store.getPersistent<string>('amazon.in:login-selector')
    expect(persistent).toBe('#nav-link-accountList')

    // 3. Document assets
    store.storeDocument('doc-inv-99', { invoiceTotal: 450.0, vendor: 'Amazon' }, prov)
    const doc = store.getDocument<{ invoiceTotal: number }>('doc-inv-99')
    expect(doc?.invoiceTotal).toBe(450.0)

    // 4. OCR assets
    store.storeOcr('img-hash-11', { text: 'TAX INVOICE 2026', confidence: 0.92 }, prov)
    const ocr = store.getOcr<{ text: string }>('img-hash-11')
    expect(ocr?.text).toBe('TAX INVOICE 2026')
  })

  it('BrowserKnowledgeGraph builds structured website hierarchy and actions', () => {
    const store = new KnowledgeStore()
    const graph = store.getBrowserGraph()
    const prov = createProvenance('browser')

    graph.recordPage(
      'amazon.in',
      {
        path: '/gp/css/order-history',
        url: 'https://amazon.in/gp/css/order-history',
        title: 'Your Orders',
        forms: [
          { name: 'orderFilter', type: 'select', label: 'Past 3 months', required: false },
        ],
        actions: [
          {
            actionId: 'download-invoice',
            name: 'Download Invoice',
            targetSelector: 'a.download-invoice-link',
            actionType: 'download',
          },
        ],
        requiresAuth: true,
      },
      prov
    )

    graph.setAuthentication('amazon.in', true)

    const domainGraph = graph.getDomainGraph('amazon.in')
    expect(domainGraph).toBeDefined()
    expect(domainGraph?.authenticated).toBe(true)

    const pageNode = graph.getPageNode('amazon.in', '/gp/css/order-history')
    expect(pageNode?.title).toBe('Your Orders')
    expect(pageNode?.forms[0]?.name).toBe('orderFilter')
    expect(pageNode?.actions[0]?.actionId).toBe('download-invoice')
    expect(pageNode?.visitCount).toBe(1)

    // Subsequent visit increments visit count
    graph.recordPage('amazon.in', pageNode!)
    const updatedNode = graph.getPageNode('amazon.in', '/gp/css/order-history')
    expect(updatedNode?.visitCount).toBe(2)
  })
})
