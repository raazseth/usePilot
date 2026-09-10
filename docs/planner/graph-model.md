# Explicit Task Graph (DAG)

## Purpose

Instead of implicit dependencies buried within task fields, `GraphBuilder` produces an explicit, mathematically verified Directed Acyclic Graph (DAG) using Kahn's algorithm. The execution engine consumes this graph directly without recalculating topological order.

## Schema

```typescript
export interface DAGNode {
  taskId: string
  layer: number
  isCritical: boolean
  canParallelize: boolean
  inDegree: number
  outDegree: number
  isOptional?: boolean | undefined
  estimatedComplexity?: Complexity | undefined
  expectedOutput?: string | undefined
  parallelGroupId?: string | undefined
}

export type DAGEdgeType = 'depends_on' | 'triggers' | 'blocks'

export interface DAGEdge {
  from: string
  to: string
  type: DAGEdgeType
  metadata?: Record<string, unknown> | undefined
}

export interface TaskGraph {
  nodes: DAGNode[]
  edges: DAGEdge[]
  parallelGroups: string[][]
  criticalPath: string[]
  taskCount: number
  depth: number
}
```

## Topological Ordering & Parallelism

- **`layer`**: Identifies topological depth (0 = no dependencies, root node) for batch sequencing.
- **`parallelGroups`**: Pre-computed groups of task IDs that can execute concurrently without resource or capability contention.
- **`criticalPath`**: Ordered task IDs along the longest dependency chain, defining the theoretical minimum execution time.
- **`depth`**: Total number of execution layers in the DAG.
- **`taskCount`**: Total number of task nodes in the graph.

