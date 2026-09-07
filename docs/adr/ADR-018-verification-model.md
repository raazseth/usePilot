# ADR-018: Independent Verification Engine and Failure Categorization

## Context
Adapters returning exit code 0 or an HTTP 200 do not guarantee that the desired domain outcome was actually achieved.

## Decision
Route all adapter results through `VerificationEngine`. It validates stated postconditions and plan success criteria before a task can transition to `completed`. Any failure is classified into discrete categories (`adapter_failure`, `verification_failure`, `approval_denied`, `dependency_failure`, `timeout`, `cancellation`, `configuration`).

## Consequences
- Prevents false-positive completions and compounding errors downstream.
- Provides actionable telemetry on whether failures stem from infrastructure, code, or user denial.
