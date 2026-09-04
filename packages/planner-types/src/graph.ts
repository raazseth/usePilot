// ─────────────────────────────────────────────────────────────────────────────
// Task Graph Types
// The graph is represented explicitly as nodes + edges, not hidden inside
// task dependency arrays. Future visualization requires zero model changes.
// ─────────────────────────────────────────────────────────────────────────────

import type { Complexity } from './intent'

/**
 * A node in the execution DAG, enriched with graph-level metadata.
 */
export interface DAGNode {
  /** Must match a Task.id in the same graph */
  taskId: string
  /** Topological depth (0 = no dependencies, root node) */
  layer: number
  /** Whether this node lies on the critical path */
  isCritical: boolean
  /** Whether this node can be executed in parallel with sibling nodes in the same layer */
  canParallelize: boolean
  /** Number of direct predecessors */
  inDegree: number
  /** Number of direct successors */
  outDegree: number
  /** Whether this task is optional for goal success */
  isOptional?: boolean | undefined
  /** Estimated subjective complexity of this task node */
  estimatedComplexity?: Complexity | undefined
  /** Expected output artifact or state */
  expectedOutput?: string | undefined
  /** Identifier of the parallel group this node belongs to, if any */
  parallelGroupId?: string | undefined
}

/**
 * The semantic type of a directed edge between two tasks.
 */
export type DAGEdgeType =
  | 'depends_on'  // Standard dependency — 'to' cannot run until 'from' completes
  | 'triggers'    // 'from' completing causes 'to' to start immediately
  | 'blocks'      // 'from' failure prevents 'to' from running

/**
 * A directed edge in the execution DAG.
 */
export interface DAGEdge {
  /** Source task ID */
  from: string
  /** Target task ID */
  to: string
  type: DAGEdgeType
  /** Optional extra context (e.g. pass-through output fields) */
  metadata?: Record<string, unknown> | undefined
}

/**
 * An explicit, fully-resolved Directed Acyclic Graph of tasks.
 * Built deterministically by GraphBuilder — no LLM involvement.
 */
export interface TaskGraph {
  /** All nodes in the graph, ordered by topological sort (layer ASC) */
  nodes: DAGNode[]
  /** All directed edges */
  edges: DAGEdge[]
  /**
   * Groups of task IDs that can be executed concurrently.
   * Each sub-array is one parallel batch.
   */
  parallelGroups: string[][]
  /**
   * Ordered task IDs along the longest dependency chain.
   * Phase 3 uses this to estimate minimum sequential runtime.
   */
  criticalPath: string[]
  /** Total number of tasks */
  taskCount: number
  /** Number of topological layers */
  depth: number
}
