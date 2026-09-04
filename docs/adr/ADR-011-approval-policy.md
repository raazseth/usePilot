# ADR-011: Multi-Tier ApprovalPolicy Governance

## Context
A binary approval flag (`approvalRequired: boolean`) is insufficient for a desktop AI assistant that performs actions ranging from reading web text to executing shell scripts and deleting files.

## Decision
Adopt a four-level policy enum:
- `automatic`: Safe, non-mutating actions that execute unhindered.
- `optional`: Mildly mutating actions user may optionally review.
- `mandatory`: High-risk actions (financial transactions, file deletions, auth) that pause execution until human confirmation.
- `forbidden`: Catastrophic operations (system directory manipulation, destructive disk wipes) that immediately invalidate the entire blueprint.

## Consequences
- Fine-grained security governance.
- Transparent reasons logged and displayed to the user for every policy decision.
- Guaranteed protection against dangerous automated operations.
