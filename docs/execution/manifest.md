# Execution Manifest

The `ExecutionManifest` is an immutable, cryptographic receipt produced at the conclusion of every execution run.

## Purpose

1. **Audit & Forensics**: Proves exactly which blueprint was executed, under what policy, using which adapters, and what the outcome was.
2. **Deterministic Hashing**: A SHA-256 hash computed over normalized execution parameters ensures tamper evidence.
3. **Historical Analysis**: Stores operational metrics (run duration, task counts, error and recovery frequencies) for regression and performance tracking.

## Manifest Schema

```typescript
export interface SelectedAdapterRecord {
  readonly capabilityId: TaskCapability
  readonly adapterId: string
  readonly adapterName: string
  readonly isSandboxed: boolean
  readonly tasksExecuted: number
  readonly errorCount: number
  readonly recoveryCount: number
}

export interface ExecutionManifest {
  readonly manifestId: string
  readonly runId: string
  readonly blueprintId: string
  readonly blueprintHash: string
  readonly executedAt: number
  readonly completedAt: number
  readonly durationMs: number
  readonly status: 'completed' | 'failed' | 'aborted'
  readonly totalTasks: number
  readonly completedTasks: number
  readonly failedTasks: number
  readonly selectedAdapters: ReadonlyArray<SelectedAdapterRecord>
  readonly policy: ExecutionPolicy
  readonly environment: {
    readonly nodeVersion: string
    readonly platform: string
    readonly arch: string
  }
  readonly contentHash: string // SHA-256 digest of canonical execution data
}
```

## Generation & Verification

Manifests are created by `ManifestGenerator`:

```typescript
const manifest = ManifestGenerator.generate({
  runId,
  blueprint,
  result,
  policy,
  selectedAdapters,
  sessionManager,
})
```

`ManifestGenerator.verify(manifest)` can be invoked at any time to recompute the SHA-256 digest over the manifest's canonical payload and verify that the manifest has not been modified or corrupted.

## Storage

Manifests are saved to SQLite in the `execution_manifests` table and accessible via:
- `ExecutionManifestRepository.findByRunId(runId)`
- `ExecutionService.getExecutionManifest(runId)`
