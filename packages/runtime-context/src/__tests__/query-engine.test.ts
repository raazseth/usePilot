import { describe, it, expect } from 'vitest'

import { createProvenance } from '../core/provenance'
import { MemoryContextStore } from '../core/store'
import { RuntimeIndexEngine } from '../index/runtime-index'
import { KnowledgeStore } from '../knowledge/knowledge-store'
import { ExecutionMemoryStore } from '../memory/execution-memory'
import type { ExecutionMemoryRecord } from '../memory/types'
import { ObservationEngine } from '../observations/observation-engine'
import type { BrowserObservation } from '../observations/types'
import { RuntimeQueryEngine } from '../retrieval/query-engine'

describe('Unified RuntimeQueryEngine & Execution Memory (Deliverables 6, 7 & Requirement 2)', () => {
  it('RuntimeQueryEngine unifies all runtime access through a single API', async () => {
    const contextStore = new MemoryContextStore()
    const observationEngine = new ObservationEngine()
    const knowledgeStore = new KnowledgeStore()
    const indexEngine = new RuntimeIndexEngine()
    const executionMemory = new ExecutionMemoryStore()

    const queryEngine = new RuntimeQueryEngine({
      contextStore,
      observationEngine,
      knowledgeStore,
      indexEngine,
      executionMemory,
    })

    const prov = createProvenance('browser')

    // 1. Seed observation
    const obs: BrowserObservation = {
      id: 'obs-q-1',
      type: 'browser_state',
      timestamp: Date.now(),
      source: 'browser',
      confidence: 1.0,
      provenance: prov,
      payload: {
        currentUrl: 'https://github.com/dashboard',
        pageTitle: 'Dashboard',
        domain: 'github.com',
        domFingerprint: 'fp-1',
        interactiveElements: [],
        viewport: { width: 1920, height: 1080 },
      },
    }
    observationEngine.emit(obs)

    // 2. Seed knowledge graph
    knowledgeStore.getBrowserGraph().recordPage(
      'github.com',
      {
        path: '/dashboard',
        url: 'https://github.com/dashboard',
        title: 'Dashboard',
        forms: [],
        actions: [],
        requiresAuth: true,
      },
      prov
    )

    // 3. Seed indexed document
    indexEngine.index({
      id: 'doc-q-1',
      entityType: 'document',
      title: 'GitHub Pull Request Workflow',
      content: 'Steps to review and merge PRs on GitHub repository.',
      tags: ['github', 'pr'],
      provenance: prov,
      indexedAt: Date.now(),
    })

    // 4. Seed execution memory
    const execRecord: ExecutionMemoryRecord = {
      id: 'exec-mem-1',
      executionId: 'run-999',
      blueprintId: 'bp-github-pr',
      intent: 'review all open pull requests',
      capabilitySequence: ['navigate_website', 'extract_web_data'],
      domainTargets: ['github.com'],
      success: true,
      durationMs: 4200,
      approvalCount: 0,
      verificationPassed: true,
      healingEventCount: 0,
      artifactsProducedCount: 1,
      provenance: prov,
      timestamp: Date.now(),
      tags: ['github', 'review'],
    }
    executionMemory.recordExecution(execRecord)

    // Query via unified query()
    const bundle = await queryEngine.query({
      intent: 'review all open pull requests',
      domain: 'github.com',
    })

    expect(bundle.recentObservations.length).toBeGreaterThanOrEqual(1)
    expect(bundle.domainGraph?.domain).toBe('github.com')
    expect(bundle.relevantDocuments.length).toBeGreaterThanOrEqual(1)
    expect(bundle.bestExecutionPattern?.blueprintId).toBe('bp-github-pr')

    // Test direct individual unified methods:
    // a. search()
    const searchResults = queryEngine.search({ query: 'Workflow' })
    expect(searchResults.length).toBe(1)

    // b. observe()
    const observations = queryEngine.observe({ type: 'browser_state' })
    expect(observations.length).toBe(1)

    // c. graph()
    const graph = queryEngine.graph('github.com')
    expect(graph?.nodes['/dashboard']?.title).toBe('Dashboard')

    // d. executions()
    const execs = queryEngine.executions({ domain: 'github.com' })
    expect(execs.length).toBe(1)
    expect(execs[0]?.executionId).toBe('run-999')
  })
})
