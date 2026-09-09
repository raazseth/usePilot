import type { RuntimeEntityGraph } from '../../graph/entity-graph'
import type {
  EntityGraphQuery,
  GraphEntity,
  GraphRelationship,
  RelationshipType,
} from '../../graph/types'

export class EntitiesDomain {
  private entityGraph: RuntimeEntityGraph

  constructor(entityGraph: RuntimeEntityGraph) {
    this.entityGraph = entityGraph
  }

  addEntity(entity: Omit<GraphEntity, 'createdAt' | 'updatedAt'>): GraphEntity {
    return this.entityGraph.addEntity(entity)
  }

  getEntity(id: string): GraphEntity | undefined {
    return this.entityGraph.getEntity(id)
  }

  removeEntity(id: string): boolean {
    return this.entityGraph.removeEntity(id)
  }

  addRelationship(
    sourceId: string,
    targetId: string,
    type: RelationshipType,
    properties?: Record<string, unknown>
  ): GraphRelationship {
    return this.entityGraph.addRelationship(sourceId, targetId, type, properties)
  }

  removeRelationship(id: string): boolean {
    return this.entityGraph.removeRelationship(id)
  }

  getNeighbors(
    entityId: string,
    relationshipType?: RelationshipType,
    direction: 'outgoing' | 'incoming' | 'both' = 'both'
  ): { entity: GraphEntity; relationship: GraphRelationship }[] {
    return this.entityGraph.getNeighbors(entityId, relationshipType, direction)
  }

  query(q: EntityGraphQuery = {}): { entities: GraphEntity[]; relationships: GraphRelationship[] } {
    return this.entityGraph.query(q)
  }

  count(): { entities: number; relationships: number } {
    return this.entityGraph.count()
  }

  clear(): void {
    this.entityGraph.clear()
  }
}
