import type {
  EntityType,
  RelationshipType,
  GraphEntity,
  GraphRelationship,
  EntityGraphQuery,
} from './types'

export class RuntimeEntityGraph {
  private static instance: RuntimeEntityGraph | null = null
  private entities = new Map<string, GraphEntity>()
  private relationships = new Map<string, GraphRelationship>()

  // Adjacency indices for high-speed graph traversal
  private outgoing = new Map<string, Set<string>>()
  private incoming = new Map<string, Set<string>>()

  static getInstance(): RuntimeEntityGraph {
    if (!RuntimeEntityGraph.instance) {
      RuntimeEntityGraph.instance = new RuntimeEntityGraph()
    }
    return RuntimeEntityGraph.instance
  }

  addEntity(
    entity: Omit<GraphEntity, 'createdAt' | 'updatedAt'>
  ): GraphEntity {
    const now = Date.now()
    const existing = this.entities.get(entity.id)
    const fullEntity: GraphEntity = {
      ...entity,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    }
    this.entities.set(entity.id, fullEntity)
    return fullEntity
  }

  getEntity(id: string): GraphEntity | undefined {
    return this.entities.get(id)
  }

  removeEntity(id: string): boolean {
    const removed = this.entities.delete(id)
    if (!removed) return false

    // Clean up associated relationships
    const relsToRemove: string[] = []
    for (const rel of this.relationships.values()) {
      if (rel.sourceId === id || rel.targetId === id) {
        relsToRemove.push(rel.id)
      }
    }
    for (const relId of relsToRemove) {
      this.removeRelationship(relId)
    }

    this.outgoing.delete(id)
    this.incoming.delete(id)
    return true
  }

  addRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
    properties?: Record<string, unknown>
  ): GraphRelationship {
    if (!this.entities.has(sourceId)) {
      throw new Error(`Cannot create relationship: source entity "${sourceId}" does not exist in graph`)
    }
    if (!this.entities.has(targetId)) {
      throw new Error(`Cannot create relationship: target entity "${targetId}" does not exist in graph`)
    }

    const id = `rel-${sourceId}-${type}-${targetId}`
    const rel: GraphRelationship = {
      id,
      sourceId,
      targetId,
      type,
      createdAt: Date.now(),
    }
    if (properties !== undefined) rel.properties = properties

    this.relationships.set(id, rel)

    // Index outgoing
    let outSet = this.outgoing.get(sourceId)
    if (!outSet) {
      outSet = new Set()
      this.outgoing.set(sourceId, outSet)
    }
    outSet.add(id)

    // Index incoming
    let inSet = this.incoming.get(targetId)
    if (!inSet) {
      inSet = new Set()
      this.incoming.set(targetId, inSet)
    }
    inSet.add(id)

    return rel
  }

  removeRelationship(id: string): boolean {
    const rel = this.relationships.get(id)
    if (!rel) return false

    this.outgoing.get(rel.sourceId)?.delete(id)
    this.incoming.get(rel.targetId)?.delete(id)
    return this.relationships.delete(id)
  }

  getNeighbors(
    entityId: string,
    relationshipType?: RelationshipType,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): { entity: GraphEntity; relationship: GraphRelationship }[] {
    const results: { entity: GraphEntity; relationship: GraphRelationship }[] = []
    const relIds = new Set<string>()

    if (direction === 'outgoing' || direction === 'both') {
      for (const id of this.outgoing.get(entityId) ?? []) {
        relIds.add(id)
      }
    }
    if (direction === 'incoming' || direction === 'both') {
      for (const id of this.incoming.get(entityId) ?? []) {
        relIds.add(id)
      }
    }

    for (const relId of relIds) {
      const rel = this.relationships.get(relId)
      if (!rel) continue
      if (relationshipType && rel.type !== relationshipType) continue

      const otherId = rel.sourceId === entityId ? rel.targetId : rel.sourceId
      const targetEntity = this.entities.get(otherId)
      if (targetEntity) {
        results.push({ entity: targetEntity, relationship: rel })
      }
    }

    return results
  }

  query(q: EntityGraphQuery): { entities: GraphEntity[]; relationships: GraphRelationship[] } {
    let matchedEntities = Array.from(this.entities.values())
    if (q.entityType) {
      matchedEntities = matchedEntities.filter((e) => e.type === q.entityType)
    }

    let matchedRelationships = Array.from(this.relationships.values())
    if (q.relationshipType) {
      matchedRelationships = matchedRelationships.filter((r) => r.type === q.relationshipType)
    }
    if (q.sourceId) {
      matchedRelationships = matchedRelationships.filter((r) => r.sourceId === q.sourceId)
    }
    if (q.targetId) {
      matchedRelationships = matchedRelationships.filter((r) => r.targetId === q.targetId)
    }

    return {
      entities: matchedEntities,
      relationships: matchedRelationships,
    }
  }

  count(): { entities: number; relationships: number } {
    return {
      entities: this.entities.size,
      relationships: this.relationships.size,
    }
  }

  clear(): void {
    this.entities.clear()
    this.relationships.clear()
    this.outgoing.clear()
    this.incoming.clear()
  }
}
