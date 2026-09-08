# ADR-035: Automated Failure Bundle Packaging

## Context
When an automated task fails, triaging the issue requires assembling logs, error stack traces, current DOM snapshots, screenshot captures, network responses, and execution policy settings. Manually collecting these artifacts across disparate directories is tedious and error-prone.

## Decision
Implement `FailureBundleGenerator`:
1. **Automated Trigger**: When an execution terminates with a failed status, the runtime automatically packages all relevant diagnostic assets into a self-contained `failure-bundle` directory.
2. **Diagnostic Manifest**: Compiles `failure-manifest.json` detailing failure reason, failed task, verification failures, policy snapshot, journal entries, and inventory of captured artifacts.
3. **Exportability**: Enables one-click download or archiving for bug reporting and offline review.

## Consequences
- Fast, comprehensive diagnostic resolution for non-technical users and developers.
- Eliminates guesswork by preserving the exact failure state permanently.
