# Verification Engine

In usePilot, an adapter reporting `success: true` is necessary but not sufficient for task completion. The `VerificationEngine` independently verifies that stated outcomes, postconditions, and blueprint success criteria hold before marking a task complete.

## Verification Levels

```typescript
export type VerificationLevel = 'strict' | 'standard' | 'best_effort'
```

- **`strict`**: All conditions must pass. Automatically enforced on destructive capabilities (`delete_file`, `execute_command`) or when configured by policy.
- **`standard`**: Verifies success conditions and postconditions. Failures trigger retries or halt execution.
- **`best_effort`**: Conditions are evaluated; non-passing conditions are downgraded to warnings without failing the task.

## Verification Process

```text
AdapterResult ──► VerificationEngine ──► VerificationResult
                         │
        ┌────────────────┴────────────────┐
        ▼                                 ▼
Task Success & Postconditions    Blueprint SuccessCriteria
```

```typescript
export interface VerificationResult {
  passed: boolean
  level?: VerificationLevel | undefined
  checkedConditions: string[]
  failedConditions: string[]
  warnings?: string[] | undefined
  strategy: SuccessCriteria['verificationStrategy']
  notes?: string | undefined
  durationMs: number
}
```

## Failure Classification

Failures during execution are classified into deterministic categories:
- `adapter_failure`: Exception or runtime failure within adapter code.
- `verification_failure`: Stated postconditions or blueprint success criteria failed validation.
- `approval_denied`: User rejected a mandatory human-in-the-loop approval gate.
- `dependency_failure`: An upstream task dependency failed, preventing downstream execution.
- `timeout`: Task execution exceeded its allocated deadline.
- `cancellation`: Run was cancelled by user or system signal.
- `configuration`: Missing adapter or incompatible runtime configuration.
- Granular taxonomy: `planner_failure`, `capability_failure`, `permission_failure`, `environment_failure`, `policy_failure`, `resource_failure`.

## Failure Bundling

When a terminal failure occurs, the `FailureBundleGenerator` collates journal entries, verification failures, policy snapshots, and runtime artifacts into a self-contained archive (`failure-bundle/failure-manifest.json`) for forensic analysis and deterministic replay.
