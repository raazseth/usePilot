import { describe, expect, it, beforeEach } from 'vitest'
import { RuntimeEntityGraph } from '../graph/entity-graph'

describe('RuntimeEntityGraph', () => {
  let graph: RuntimeEntityGraph

  beforeEach(() => {
    graph = new RuntimeEntityGraph()
  })

  it('manages entities with unique identifiers and timestamps', () => {
    const user = graph.addEntity({
      id: 'usr-1',
      type: 'User',
      name: 'Raaz Seth',
    })
    expect(user.id).toBe('usr-1')
    expect(user.type).toBe('User')
    expect(user.createdAt).toBeGreaterThan(0)
    expect(user.updatedAt).toBeGreaterThan(0)

    const fetched = graph.getEntity('usr-1')
    expect(fetched).toEqual(user)
  })

  it('connects entities via typed relationships and enables traversal', () => {
    // Entities: amazon.in -> GST Invoice -> Downloaded PDF -> Execution #42 -> Verification
    graph.addEntity({ id: 'site-amazon', type: 'Website', name: 'amazon.in' })
    graph.addEntity({ id: 'doc-invoice', type: 'Document', name: 'GST Invoice' })
    graph.addEntity({ id: 'file-pdf', type: 'File', name: 'Downloaded PDF' })
    graph.addEntity({ id: 'exec-42', type: 'Execution', name: 'Execution #42' })
    graph.addEntity({ id: 'task-verify', type: 'Task', name: 'Verification' })

    graph.addRelationship('site-amazon', 'doc-invoice', 'generated')
    graph.addRelationship('doc-invoice', 'file-pdf', 'downloaded')
    graph.addRelationship('file-pdf', 'exec-42', 'belongs_to')
    graph.addRelationship('exec-42', 'task-verify', 'verified_by')

    const siteNeighbors = graph.getNeighbors('site-amazon', 'generated', 'outgoing')
    expect(siteNeighbors.length).toBe(1)
    expect(siteNeighbors[0]?.entity.id).toBe('doc-invoice')

    const fileIncoming = graph.getNeighbors('file-pdf', 'downloaded', 'incoming')
    expect(fileIncoming.length).toBe(1)
    expect(fileIncoming[0]?.entity.id).toBe('doc-invoice')

    const counts = graph.count()
    expect(counts.entities).toBe(5)
    expect(counts.relationships).toBe(4)
  })

  it('filters entities and relationships by query criteria', () => {
    graph.addEntity({ id: 'u1', type: 'User', name: 'Alice' })
    graph.addEntity({ id: 'w1', type: 'Website', name: 'github.com' })
    graph.addRelationship('u1', 'w1', 'opened')

    const userQuery = graph.query({ entityType: 'User' })
    expect(userQuery.entities.length).toBe(1)
    expect(userQuery.entities[0]?.id).toBe('u1')

    const relQuery = graph.query({ relationshipType: 'opened' })
    expect(relQuery.relationships.length).toBe(1)
    expect(relQuery.relationships[0]?.sourceId).toBe('u1')
    expect(relQuery.relationships[0]?.targetId).toBe('w1')
  })

  it('cascades deletion of an entity to its associated relationships', () => {
    graph.addEntity({ id: 'app1', type: 'Application', name: 'VS Code' })
    graph.addEntity({ id: 'win1', type: 'Window', name: 'Main Editor' })
    graph.addRelationship('app1', 'win1', 'opened')

    expect(graph.count().relationships).toBe(1)
    const removed = graph.removeEntity('app1')
    expect(removed).toBe(true)
    expect(graph.getEntity('app1')).toBeUndefined()
    expect(graph.count().relationships).toBe(0)
    expect(graph.getNeighbors('win1', undefined, 'both').length).toBe(0)
  })
})
