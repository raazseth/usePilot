# Public API Reference & Parity Matrix

This document defines the formal public API surface of usePilot across its core workspace packages, providing export parity tracking, architectural decision references, test suite coverage, and code examples.

---

## 1. Export ↔ Documentation Parity Matrix

### `@usepilot/planner-types` & `@usepilot/planner-core`

| Exported Symbol | Kind | Purpose | Documented Guide | ADR | Test Suite |
|---|---|---|---|---|---|
| `Planner` | Class | 14-stage cognitive planner orchestrator | [planner-overview.md](../planner/planner-overview.md) | [ADR-007](../adr/ADR-007-request-classifier.md)–[ADR-012](../adr/ADR-012-plan-optimizer.md) | `packages/planner-core/src/__tests__/planner.test.ts` |
| `RequestClassifier` | Class | Two-pass intent router (heuristics + LLM) | [request-classifier.md](../planner/request-classifier.md) | [ADR-007](../adr/ADR-007-request-classifier.md) | `packages/planner-core/src/__tests__/classifier.test.ts` |
| `Normalizer` | Class | Text cleaning and entity extraction | [normalizer.md](../planner/normalizer.md) | [ADR-008](../adr/ADR-008-normalizer.md) | `packages/planner-core/src/__tests__/normalizer.test.ts` |
| `GoalExtractor` | Class | Canonical goal extractor from text | [goal-model.md](../planner/goal-model.md) | [ADR-008](../adr/ADR-008-normalizer.md) | `packages/planner-core/src/__tests__/goal.test.ts` |
| `GoalValidator` | Class | Goal completeness and constraint validation | [goal-model.md](../planner/goal-model.md) | [ADR-008](../adr/ADR-008-normalizer.md) | `packages/planner-core/src/__tests__/goal.test.ts` |
| `TaskGenerator` | Class | Atomic task generator with capabilities | [task-model.md](../planner/task-model.md) | [ADR-010](../adr/ADR-010-task-graph-dag.md) | `packages/planner-core/src/__tests__/tasks.test.ts` |
| `ApprovalEngine` | Class | Safety evaluator for 4-tier approval policy | [approval-policy.md](../planner/approval-policy.md) | [ADR-011](../adr/ADR-011-approval-policy.md) | `packages/planner-core/src/__tests__/approval.test.ts` |
| `GraphBuilder` | Class | Deterministic Kahn DAG and critical path generator | [graph-model.md](../planner/graph-model.md) | [ADR-010](../adr/ADR-010-task-graph-dag.md) | `packages/planner-core/src/__tests__/graph.test.ts` |
| `SchemaValidator` | Class | Structural Zod validation layer | [validation-layers.md](../planner/validation-layers.md) | [ADR-009](../adr/ADR-009-three-layer-validation.md) | `packages/planner-core/src/__tests__/validation.test.ts` |
| `SemanticValidator` | Class | Domain integrity and goal coverage validation | [validation-layers.md](../planner/validation-layers.md) | [ADR-009](../adr/ADR-009-three-layer-validation.md) | `packages/planner-core/src/__tests__/validation.test.ts` |
| `ExecutionValidator` | Class | Cycle detection and forbidden task validation | [validation-layers.md](../planner/validation-layers.md) | [ADR-009](../adr/ADR-009-three-layer-validation.md) | `packages/planner-core/src/__tests__/validation.test.ts` |
| `PlanOptimizer` | Class | Deduplication and sequential task merger | [optimizer.md](../planner/optimizer.md) | [ADR-012](../adr/ADR-012-plan-optimizer.md) | `packages/planner-core/src/__tests__/optimizer.test.ts` |
| `PlanSerializer` | Class | SHA-256 fingerprinting and blueprint stamping | [planner-overview.md](../planner/planner-overview.md) | [ADR-010](../adr/ADR-010-task-graph-dag.md) | `packages/planner-core/src/__tests__/serializer.test.ts` |
| `PlannerContextBuilder` | Class | Aggregates host platform, tools, and history | [planner-context.md](../planner/planner-context.md) | [ADR-010](../adr/ADR-010-task-graph-dag.md) | `packages/planner-core/src/__tests__/context.test.ts` |
| `ExecutionBlueprint` | Type | Final immutable output of planning | [planner-overview.md](../planner/planner-overview.md) | [ADR-010](../adr/ADR-010-task-graph-dag.md) | `packages/planner-types/src/blueprint.ts` |
| `TaskCapability` | Type | 17 canonical abstract task capabilities | [task-model.md](../planner/task-model.md) | [ADR-014](../adr/ADR-014-capability-registry.md) | `packages/planner-types/src/task.ts` |

---

### `@usepilot/execution-types` & `@usepilot/execution-core`

| Exported Symbol | Kind | Purpose | Documented Guide | ADR | Test Suite |
|---|---|---|---|---|---|
| `ExecutionRunner` | Class | State machine execution orchestrator | [runtime.md](../execution/runtime.md) | [ADR-013](../adr/ADR-013-execution-runtime.md) | `packages/execution-core/src/__tests__/runner.test.ts` |
| `createExecutionRunner` | Function | Factory initializing runner with default deps | [runtime.md](../execution/runtime.md) | [ADR-013](../adr/ADR-013-execution-runtime.md) | `packages/execution-core/src/__tests__/runner.test.ts` |
| `CapabilityRegistry` | Class | Dynamic capability-to-adapter registry | [registry.md](../execution/registry.md) | [ADR-014](../adr/ADR-014-capability-registry.md) | `packages/execution-core/src/__tests__/registry.test.ts` |
| `createProductionRegistry` | Function | Factory pre-registering native adapters | [registry.md](../execution/registry.md) | [ADR-014](../adr/ADR-014-capability-registry.md) | `packages/execution-core/src/__tests__/registry.test.ts` |
| `PolicyBasedCapabilityNegotiator` | Class | Evaluates candidate adapters against policies | [negotiation.md](../execution/negotiation.md) | [ADR-020](../adr/ADR-020-capability-negotiation.md) | `packages/execution-core/src/__tests__/negotiator.test.ts` |
| `CAPABILITY_DEPENDENCY_GRAPH` | Const | Static map of subsystem and permission requirements | [negotiation.md](../execution/negotiation.md) | [ADR-020](../adr/ADR-020-capability-negotiation.md) | `packages/execution-types/src/dependencies.ts` |
| `TaskScheduler` | Class | Topological DAG batch partitioner | [scheduler.md](../execution/scheduler.md) | [ADR-013](../adr/ADR-013-execution-runtime.md) | `packages/execution-core/src/__tests__/scheduler.test.ts` |
| `ExecutionStateMachine` | Class | Validates run and task state transitions | [state-machine.md](../execution/state-machine.md) | [ADR-013](../adr/ADR-013-execution-runtime.md) | `packages/execution-core/src/__tests__/state-machine.test.ts` |
| `ApprovalGate` | Class | Manages human-in-the-loop approval gates | [approval-policy.md](../planner/approval-policy.md) | [ADR-011](../adr/ADR-011-approval-policy.md) | `packages/execution-core/src/__tests__/approval-gate.test.ts` |
| `AdapterSandbox` | Class | Enforces timeouts, panic recovery, output capture | [sandbox.md](../execution/sandbox.md) | [ADR-019](../adr/ADR-019-adapter-sandbox.md) | `packages/execution-core/src/__tests__/sandbox.test.ts` |
| `VerificationEngine` | Class | Deterministic postcondition verification | [verification.md](../execution/verification.md) | [ADR-018](../adr/ADR-018-verification-model.md) | `packages/execution-core/src/__tests__/verification.test.ts` |
| `RetryEngine` | Class | Infrastructure-level exponential backoff retries | [retry.md](../execution/retry.md) | [ADR-013](../adr/ADR-013-execution-runtime.md) | `packages/execution-core/src/__tests__/retry.test.ts` |
| `ExecutionJournal` | Class | Append-only audit log manager | [journal.md](../execution/journal.md) | [ADR-016](../adr/ADR-016-execution-journal.md) | `packages/execution-core/src/__tests__/journal.test.ts` |
| `ExecutionTimelineBuilder` | Class | Lightweight reference index of execution events | [journal.md](../execution/journal.md) | [ADR-016](../adr/ADR-016-execution-journal.md) | `packages/execution-core/src/__tests__/timeline.test.ts` |
| `CheckpointManager` | Class | State snapshotting at batch & approval boundaries | [checkpoints.md](../execution/checkpoints.md) | [ADR-017](../adr/ADR-017-checkpoint-strategy.md) | `packages/execution-core/src/__tests__/checkpoint.test.ts` |
| `SessionManager` | Class | Stateful adapter session pooling and recovery | [sessions.md](../execution/sessions.md) | [ADR-021](../adr/ADR-021-adapter-sessions.md) | `packages/execution-core/src/__tests__/session.test.ts` |
| `ExecutionPolicyEngine` | Class | Runtime parameters for retry, approval, timeout | [policy.md](../execution/policy.md) | [ADR-022](../adr/ADR-022-execution-policy-engine.md) | `packages/execution-core/src/__tests__/policy.test.ts` |
| `ManifestGenerator` | Class | Generates and verifies cryptographic receipts | [manifest.md](../execution/manifest.md) | [ADR-023](../adr/ADR-023-execution-manifest.md) | `packages/execution-core/src/__tests__/manifest.test.ts` |
| `PlaywrightBrowserAdapter` | Class | Production browser automation adapter | [adapters.md](../execution/adapters.md) | [ADR-024](../adr/ADR-024-browser-runtime.md) | `packages/execution-core/src/__tests__/browser-adapter.test.ts` |
| `NativeFilesystemAdapter` | Class | Sandboxed native filesystem I/O adapter | [adapters.md](../execution/adapters.md) | [ADR-025](../adr/ADR-025-native-filesystem-runtime.md) | `packages/execution-core/src/__tests__/fs-adapter.test.ts` |
| `NativeDesktopAdapter` | Class | OS clipboard, window, and process adapter | [adapters.md](../execution/adapters.md) | [ADR-026](../adr/ADR-026-native-desktop-runtime.md) | `packages/execution-core/src/__tests__/desktop-adapter.test.ts` |
| `VisionSubsystem` | Class | Screenshot capture, template match, OCR | [adapters.md](../execution/adapters.md) | [ADR-027](../adr/ADR-027-vision-runtime.md) | `packages/execution-core/src/__tests__/vision.test.ts` |
| `SelfHealingPipeline` | Class | 4-stage cascading element remediation | [execution-overview.md](../execution/execution-overview.md) | [ADR-028](../adr/ADR-028-deterministic-self-healing.md) | `packages/execution-core/src/__tests__/self-healing.test.ts` |
| `SecretVault` | Class | Encrypted credentials and token vault | [execution-overview.md](../execution/execution-overview.md) | [ADR-029](../adr/ADR-029-secure-secret-vault.md) | `packages/execution-core/src/__tests__/vault.test.ts` |
| `PermissionManager` | Class | Granular permission scoping and authorization | [execution-overview.md](../execution/execution-overview.md) | [ADR-030](../adr/ADR-030-permission-manager.md) | `packages/execution-core/src/__tests__/permissions.test.ts` |
| `ArtifactStore` | Class | Large binary asset persistence on disk | [execution-overview.md](../execution/execution-overview.md) | [ADR-031](../adr/ADR-031-runtime-artifact-store.md) | `packages/execution-core/src/__tests__/artifact-store.test.ts` |
| `ExecutionReplayEngine` | Class | Step-by-step forensic execution replay | [execution-overview.md](../execution/execution-overview.md) | [ADR-034](../adr/ADR-034-execution-replay.md) | `packages/execution-core/src/__tests__/replay.test.ts` |
| `FailureBundleGenerator` | Class | Packages failure manifests, journals, artifacts | [manifest.md](../execution/manifest.md) | [ADR-035](../adr/ADR-035-failure-bundle.md) | `packages/execution-core/src/__tests__/failure-bundle.test.ts` |

---

### `@usepilot/runtime-context`

| Exported Symbol | Kind | Purpose | Documented Guide | ADR | Test Suite |
|---|---|---|---|---|---|
| `createRuntimeContextFacade` | Function | Primary factory & exclusive public API boundary | [overview.md](overview.md) | [ADR-045](../adr/ADR-045-runtime-context-facade-and-tiered-storage.md) | `packages/runtime-context/src/__tests__/facade.test.ts` |
| `RuntimeContextFacade` | Class | Domain-partitioned API facade | [overview.md](overview.md) | [ADR-045](../adr/ADR-045-runtime-context-facade-and-tiered-storage.md) | `packages/runtime-context/src/__tests__/facade.test.ts` |
| `ContextTransactionRunner` | Class | Atomic multi-subsystem transaction coordinator | [sequence-diagrams.md](sequence-diagrams.md) | [ADR-046](../adr/ADR-046-context-transactions-and-schema-versioning.md) | `packages/runtime-context/src/__tests__/transaction.test.ts` |
| `CURRENT_CONTEXT_SCHEMA_VERSION` | Const | Schema version (v1) for forward compatibility | [ownership-matrix.md](ownership-matrix.md) | [ADR-046](../adr/ADR-046-context-transactions-and-schema-versioning.md) | `packages/runtime-context/src/core/types.ts` |
| `ObservationEngine` | Class | Ring-buffered perception publisher | [overview.md](overview.md) | [ADR-038](../adr/ADR-038-observation-model.md) | `packages/runtime-context/src/__tests__/observations.test.ts` |
| `KnowledgeStore` | Class | Persistent facts, rules, and entity cache | [overview.md](overview.md) | [ADR-039](../adr/ADR-039-knowledge-store.md) | `packages/runtime-context/src/__tests__/knowledge-store.test.ts` |
| `BrowserKnowledgeGraph` | Class | Web domain topologies, routes, form fields | [overview.md](overview.md) | [ADR-040](../adr/ADR-040-browser-knowledge-graph.md) | `packages/runtime-context/src/__tests__/browser-graph.test.ts` |
| `RuntimeIndexEngine` | Class | Hybrid offline search engine (BM25 + vectors) | [overview.md](overview.md) | [ADR-041](../adr/ADR-041-unified-runtime-query-engine.md) | `packages/runtime-context/src/__tests__/runtime-index.test.ts` |
| `RuntimeEntityGraph` | Class | Multi-hop directed entity relationship graph | [overview.md](overview.md) | [ADR-043](../adr/ADR-043-runtime-entity-graph.md) | `packages/runtime-context/src/__tests__/entity-graph.test.ts` |
| `ContextInvalidationEngine` | Class | Granular cache invalidation and event cascade | [overview.md](overview.md) | [ADR-044](../adr/ADR-044-context-invalidation-and-diff-engine.md) | `packages/runtime-context/src/__tests__/invalidation.test.ts` |
| `ContextDiffEngine` | Class | Computes structured diffs between state snapshots | [overview.md](overview.md) | [ADR-044](../adr/ADR-044-context-invalidation-and-diff-engine.md) | `packages/runtime-context/src/__tests__/diff.test.ts` |
| `RuntimeStorageTierManager` | Class | Hot/warm/cold memory management and pruning | [ownership-matrix.md](ownership-matrix.md) | [ADR-045](../adr/ADR-045-runtime-context-facade-and-tiered-storage.md) | `packages/runtime-context/src/__tests__/storage-tier.test.ts` |

---

## 2. Core Subsystem Code Examples

### A. Planner Subsystem: Generating a Blueprint

```typescript
import { Planner, PlannerContextBuilder } from '@usepilot/planner-core'
import { OllamaProvider } from '@usepilot/ai-providers'

// 1. Initialize provider and planner
const provider = new OllamaProvider({ host: 'http://localhost:11434', model: 'llama3:8b' })
const planner = new Planner(provider)

// 2. Build host context
const context = new PlannerContextBuilder()
  .setPlatform('windows')
  .setAvailableTools(['browser', 'filesystem', 'terminal'])
  .setAvailableCapabilities(['navigate_website', 'download_file', 'read_file'])
  .build('conv_123')

// 3. Plan execution
const result = await planner.plan({
  userPrompt: 'Download the Q3 tax invoice from portal.example.com and save to ~/Documents/Invoices',
  context,
  onProgress: (stage, message) => console.log(`[Planner] ${stage}: ${message}`),
})

if (result.success) {
  console.log(`Blueprint created: ${result.blueprint.id} (Hash: ${result.blueprint.hash})`)
  console.log(`Task count: ${result.blueprint.tasks.length}`)
  console.log(`Mandatory approvals required: ${result.blueprint.approvals.requiresMandatoryApproval}`)
}
```

### B. Execution Subsystem: Running a Blueprint

```typescript
import {
  createExecutionRunner,
  createProductionRegistry,
  createDefaultExecutionPolicy,
} from '@usepilot/execution-core'

// 1. Build production registry with Playwright, native FS, and native desktop adapters
const registry = createProductionRegistry()

// 2. Instantiate execution runner
const { runner } = createExecutionRunner('run_456', 'trace_789', registry)

// 3. Configure runtime policy
const policy = createDefaultExecutionPolicy({
  maxParallelism: 4,
  retry: { maxAttempts: 3, initialBackoffMs: 500 },
  verification: { defaultLevel: 'standard', failFast: true },
})

// 4. Run execution
const executionResult = await runner.run(blueprint, {
  policy,
  callbacks: {
    onTaskStarted: (task) => console.log(`Starting: ${task.title}`),
    onTaskCompleted: (task, res) => console.log(`Completed: ${task.title} in ${res.durationMs}ms`),
    onApprovalRequired: (task, reason) => console.warn(`Approval Needed: ${task.title} - ${reason}`),
  },
})

console.log(`Execution status: ${executionResult.status}`)
console.log(`Sealed manifest hash: ${executionResult.manifest?.manifestHash}`)
```

### C. Runtime Context Subsystem: Atomic Transactions & Knowledge Queries

```typescript
import { createRuntimeContextFacade } from '@usepilot/runtime-context'

// 1. Instantiate unified facade
const facade = createRuntimeContextFacade()

// 2. Perform multi-store atomic mutation with automatic compensating rollback
await facade.transaction(async (tx) => {
  // Update hot state
  await tx.state.update('session_default', (draft) => {
    draft.browser.activeUrl = 'https://portal.example.com/invoices'
    draft.browser.activeDomain = 'portal.example.com'
  })

  // Record topological domain knowledge
  tx.knowledge.recordPage('portal.example.com', {
    url: 'https://portal.example.com/invoices',
    title: 'Billing Invoices',
    lastVisited: Date.now(),
    formFields: [{ name: 'year', selector: '#invoice-year', type: 'select' }],
  })

  // Link entities in the entity graph
  tx.entities.addNode({
    id: 'doc:invoice_q3',
    type: 'file',
    name: 'invoice_q3.pdf',
    attributes: { size: 1048576 },
  })
})

// 3. Query knowledge across tiers
const domainKnowledge = await facade.knowledge.getDomainKnowledge('portal.example.com')
console.log(`Recorded pages: ${domainKnowledge?.pages.length}`)
```

---

## 3. Common Architectural Anti-Patterns

1. **Direct Adapter Invocation from Planner**:
   - *Wrong*: Planner imports Playwright directly to check a webpage.
   - *Right*: Planner checks `BrowserKnowledgeGraph` via `RuntimeContextFacade`. Live automation is exclusively executed by `ExecutionRunner` via adapters.
2. **In-Place Mutation of Blueprints or Journals**:
   - *Wrong*: Modifying `blueprint.tasks` during execution to insert dynamic steps.
   - *Right*: Blueprints are cryptographically sealed. New steps require generating a new blueprint or executing through `SelfHealingPipeline`.
3. **Importing Internal Stores Directly**:
   - *Wrong*: Importing `MemoryContextStore` or `ObservationEngine` directly into backend routes.
   - *Right*: Access all context operations exclusively through `RuntimeContextFacade` or `ContextTransactionRunner`.
4. **Uncancellable Adapter Operations**:
   - *Wrong*: Performing `fetch()` or child process exec without passing `ctx.signal`.
   - *Right*: Adapters must observe `ctx.signal` and listen for `'abort'` events to support instant cooperative user cancellation.
