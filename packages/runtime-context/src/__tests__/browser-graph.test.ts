import { describe, expect, it, beforeEach } from 'vitest'
import { BrowserKnowledgeGraph } from '../knowledge/browser-graph'

describe('BrowserKnowledgeGraph Versioning and Staleness', () => {
  let graph: BrowserKnowledgeGraph

  beforeEach(() => {
    graph = new BrowserKnowledgeGraph()
  })

  it('initializes graph with version 2 on page record and computes fingerprint', () => {
    const page = graph.recordPage('amazon.in', {
      path: '/orders',
      title: 'Your Orders',
      url: 'https://amazon.in/orders',
      forms: [],
      actions: [],
    })

    expect(page.path).toBe('/orders')
    const domainGraph = graph.getDomainGraph('amazon.in')
    expect(domainGraph).toBeDefined()
    expect(domainGraph?.graphVersion).toBe(2)
    expect(domainGraph?.fingerprint).toBeTruthy()
    expect(domainGraph?.confidence).toBe(1.0)
    expect(domainGraph?.lastVerified).toBeGreaterThan(0)
  })

  it('increments version and updates fingerprint when recording forms or actions', () => {
    graph.recordPage('amazon.in', {
      path: '/login',
      title: 'Sign In',
      url: 'https://amazon.in/login',
      forms: [],
      actions: [],
    })
    const v1 = graph.getDomainGraph('amazon.in')?.graphVersion ?? 0
    const fp1 = graph.getDomainGraph('amazon.in')?.fingerprint ?? ''

    graph.recordForm('amazon.in', '/login', {
      name: 'signIn',
      action: '/post-login',
      inputs: [{ name: 'email', type: 'email', required: true, selector: '#ap_email' }],
    })

    const v2 = graph.getDomainGraph('amazon.in')?.graphVersion ?? 0
    const fp2 = graph.getDomainGraph('amazon.in')?.fingerprint ?? ''

    expect(v2).toBeGreaterThan(v1)
    expect(fp2).not.toBe(fp1)
  })

  it('detects stale domain graphs based on age and verification confidence', () => {
    graph.recordPage('amazon.in', {
      path: '/cart',
      title: 'Cart',
      url: 'https://amazon.in/cart',
      forms: [],
      actions: [],
    })

    // Currently fresh
    expect(graph.isStale('amazon.in')).toBe(false)

    // With tiny maxAgeMs threshold, reports stale
    expect(graph.isStale('amazon.in', -1)).toBe(true)

    // With lowered confidence from verification mismatch, reports stale
    graph.verifyGraph('amazon.in', 'mismatched-fingerprint')
    expect(graph.isStale('amazon.in')).toBe(true)
  })

  it('verifies graph with matching fingerprint and updates lastVerified', () => {
    graph.recordPage('amazon.in', {
      path: '/orders',
      title: 'Your Orders',
      url: 'https://amazon.in/orders',
      forms: [],
      actions: [],
    })
    const fp = graph.getDomainGraph('amazon.in')?.fingerprint

    const verified = graph.verifyGraph('amazon.in', fp, 0.95)
    expect(verified).toBe(true)
    const domain = graph.getDomainGraph('amazon.in')
    expect(domain?.confidence).toBe(0.95)
    expect(domain?.lastVerified).toBeGreaterThan(0)
  })
})
