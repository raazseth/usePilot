export type EntityType =
  | 'User'
  | 'Website'
  | 'Document'
  | 'Window'
  | 'Application'
  | 'File'
  | 'Folder'
  | 'Form'
  | 'Execution'
  | 'Task'
  | 'Adapter'
  | 'Permission'
  | 'user'
  | 'website'
  | 'document'
  | 'window'
  | 'application'
  | 'file'
  | 'folder'
  | 'form'
  | 'execution'
  | 'task'
  | 'adapter'
  | 'permission'

export type RelationshipType =
  | 'opened'
  | 'downloaded'
  | 'generated'
  | 'depends_on'
  | 'belongs_to'
  | 'references'
  | 'created_by'
  | 'verified_by'

export interface GraphEntity {
  id: string
  type: EntityType
  label?: string | undefined
  name?: string | undefined
  properties?: Record<string, unknown> | undefined
  createdAt: number
  updatedAt: number
}

export interface GraphRelationship {
  id: string
  sourceId: string
  targetId: string
  type: RelationshipType
  properties?: Record<string, unknown> | undefined
  createdAt: number
}

export interface EntityGraphQuery {
  entityType?: EntityType | undefined
  relationshipType?: RelationshipType | undefined
  sourceId?: string | undefined
  targetId?: string | undefined
}
