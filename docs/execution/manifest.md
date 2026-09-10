# Execution Manifest

The `ExecutionManifest` is an immutable, cryptographic receipt produced at the conclusion of every execution run. It seals the execution run with a SHA-256 hash over canonical parameters.

## Purpose

1. **Audit & Forensics**: Records exactly which blueprint and planner version was executed, under what policy, using which adapters, and what the final outcome was.
2. **Deterministic Hashing**: A SHA-256 hash computed over normalized execution parameters ensures tamper evidence.
3. **Operational Metrics**: Bundles execution duration, task summaries (completed, failed, skipped), and environment specifications.

## Execution Manifest Schema

```typescript
export interface SelectedAdapterRecord {
  taskId: string
  capability: string
  adapterName: string
  sessionId?: string | undefined
}

export interface ExecutionManifest {
  manifestId: string
  runId: string
  traceId: string
  blueprintHash: string
  plannerVersion: string
  executionVersion: string
  policy: ExecutionPolicy
  capabilities: string[]
  selectedAdapters: SelectedAdapterRecord[]
  environment: {
    os: string
    arch: string
    runtime: string
    nodeVersion?: string | undefined
  }
  startedAt: number
  completedAt: number
  durationMs: number
  tasksSummary: {
    total: number
    completed: number
    failed: number
    skipped: number
  }
  outcome: 'success' | 'failed' | 'cancelled'
  manifestHash: string
}
```

## Adapter Manifest Schema

Individual adapters can declare static metadata and structural constraints via `AdapterManifest`:

```typescript
export interface AdapterManifest {
  readonly name: string
  readonly version: string
  readonly apiVersion: string
  readonly runtimeVersion: string
  readonly platform: readonly ('windows' | 'macos' | 'linux')[]
  readonly permissions: readonly string[]
  readonly capabilities: readonly TaskCapability[]
  readonly featureFlags: readonly string[]
  readonly hash: string
}
```

## Generation & Verification

Manifests are created deterministically at run completion:

```typescript
const manifest = ManifestGenerator.generate({
  runId,
  traceId,
  blueprintHash,
  policy,
  capabilities,
  selectedAdapters,
  environment,
  startedAt,
  completedAt,
  tasksSummary,
  outcome,
})
```

Verification recomputes `manifestHash` over the canonicalized JSON representation (keys sorted, whitespace stripped) to ensure the manifest has not been modified after completion.

## Storage

Manifests are stored in SQLite in the `execution_manifests` table and exposed through:
- `ExecutionManifestRepository.findByRunId(runId)`
- `ExecutionRunner.run()` in `ExecutionResult.manifest`

