# Verification Engine

In usePilot, an adapter reporting `success: true` is necessary but not sufficient for task completion. The `VerificationEngine` independently verifies that stated outcomes and preconditions/postconditions hold.

## Verification Process

```text
AdapterResult ──► VerificationEngine ──► VerificationResult
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
Task Success & Postconditions    Blueprint SuccessCriteria
```

## Failure Classification

Failures during execution are classified into deterministic categories:
- `adapter_failure`: Exception or error within the adapter execution.
- `verification_failure`: Postconditions or success criteria were not satisfied.
- `approval_denied`: User rejected a mandatory approval request.
- `dependency_failure`: An upstream task dependency failed.
- `timeout`: Task or approval timed out.
- `cancellation`: Run was aborted by user or system.
- `configuration`: Missing adapter or invalid options.
