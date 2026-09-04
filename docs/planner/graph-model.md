# Explicit Task Graph (DAG)

## Purpose

Instead of implicit dependencies buried within task fields, `GraphBuilder` produces an explicit, mathematically sound Directed Acyclic Graph (DAG) using Kahn's algorithm.

## Schema

```typescript
export interface DAGNode {
  taskId: string
  metadata: {
    layer: number
    isCritical: boolean
    canParallelize: boolean
  }
}

export interface DAGEdge {
  from: string
  to: string
  type: 'depends_on' | 'triggers' | 'blocks'
  metadata?: Record<string, unknown>
}

export interface TaskGraph {
  nodes: DAGNode[]
  edges: DAGEdge[]
  parallelGroups: string[][]
  criticalPath: string[]
}
```

## Topological Ordering & Parallelism

- `layers`: Identifies topological depth for ordered sequencing.
- `parallelGroups`: Groups of independent tasks with no shared ancestors or tool conflicts that can run concurrently in Phase 3.
- `criticalPath`: The longest sequence of dependent tasks determining total plan completion path.
