# ADR-030: Runtime Permission Manager with Multi-Tier Scoping

## Context
Automated agents operating system capabilities (filesystem writes, clipboard reading, desktop command execution, and network navigation) must follow the principle of least privilege. Users require transparent control over which capabilities can access sensitive resources without being overwhelmed by repetitive prompts for low-risk actions.

## Decision
Implement `PermissionManager` integrated with `ApprovalGate`:
1. **Granular Permission Scopes**: Supports three distinct grant lifetimes:
   - `once`: Valid for a single atomic task execution only.
   - `session`: Valid for all tasks within the active execution run.
   - `always`: Persisted to local disk across application sessions.
2. **Resource Scoping**: Permissions bind to specific capability/resource pairs (e.g. `filesystem:write` on `C:\Users\Downloads`).
3. **ApprovalGate Integration**: If a task requires a capability/resource grant that is not currently held, `PermissionManager` delegates to the runtime `ApprovalGate`, pausing execution until the user explicitly approves or denies access.
4. **Zero Cloud Telemetry**: All grants are stored locally in client configuration, maintaining privacy.

## Consequences
- Protects user data and prevents unauthorized filesystem or network operations.
- Minimizes user fatigue via session and persistent grant caching while preserving security boundaries.
