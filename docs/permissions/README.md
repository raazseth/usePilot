# Permission Manager Subsystem

Permission Management (`@usepilot/execution-core/src/security/permissions`) regulates access to privileged capabilities and host resources across browser, filesystem, clipboard, process execution, and network interfaces, enforcing `once`, `session`, and `always` authorization scopes.

---

## Purpose

Autonomous agentic systems possess tools capable of reading user files, writing to the host disk, executing shell commands, modifying the system clipboard, and initiating external network connections. Allowing an agent unrestricted access to these capabilities without user authorization creates severe security vulnerabilities:
- Malicious or hallucinatory task plans could overwrite critical system files or exfiltrate sensitive local data.
- Background workflows could launch unauthorized native applications or execute arbitrary scripts.
- Unbounded permissions granted for a single operation could linger indefinitely, exposing the system to subsequent unintended mutations.

The Permission Manager Subsystem owns:
- Granular permission classification across eight concrete resources (`browser`, `filesystem:read`, `filesystem:write`, `clipboard:read`, `clipboard:write`, `desktop:launch`, `desktop:control`, `network`).
- Scope management with three distinct lifecycles (`once`, `session`, `always`).
- Automated single-use token consumption for `once` grants upon check.
- Time-based grant expiration (`expiresAt` evaluation on access).
- Mapping between planner task capabilities and underlying security resources (`mapCapabilityToResource`).
- Disk-backed persistence of permanent grants in `~/.usepilot/permissions/grants.json`.

The Permission Manager Subsystem intentionally does NOT own:
- UI prompt rendering or human approval dialogs (handled via the Approval Gate in `apps/desktop/`).
- Cryptographic credential or API key encryption (owned by `SecretVault`).
- Task planning or capability execution.

---

## Design Principles

### 1. Granular Resource Partitioning
Permissions are not binary or global. The subsystem separates read from write operations and isolates independent host environments:
- Reading a file requires `filesystem:read`, but does not authorize modifying files (`filesystem:write`).
- Reading the clipboard (`clipboard:read`) is governed separately from writing to it (`clipboard:write`).
- Web automation (`browser`) does not grant authority to launch host applications (`desktop:launch`).

### 2. Ephemeral Single-Use Authorization (`once`)
Certain high-risk actions (e.g. deleting a directory or executing a shell command) warrant permission for a single discrete step only. Grants created with scope `'once'` are stored in a dedicated memory set (`onceGrants`). When `hasPermission(resource)` evaluates a `'once'` grant, it immediately deletes the resource from the set:
```typescript
if (this.onceGrants.has(resource)) {
  this.onceGrants.delete(resource)
  return true
}
```
This guarantees that an authorization approved for a single step cannot be reused by subsequent tasks.

### 3. Graceful Expiration and Lazy Purging
Both session and persistent grants support optional duration ceilings (`durationMs`). When queried, `hasPermission()` evaluates `expiresAt`. If the timestamp is in the past, the grant is removed immediately (and the persistent manifest updated on disk) before returning `false`.

---

## Design Tradeoffs

| Decision | Alternative Considered | Why This Approach Was Chosen |
|---|---|---|
| **Single-use (`once`) grants consumed on evaluation** | Multi-step lease or time window | Prevents race conditions and unintended re-use where an authorization granted for one specific file deletion or shell execution might leak into subsequent unreviewed actions. |
| **JSON file persistence (`~/.usepilot/permissions/grants.json`)** | System keychain or SQLite database | Permissions are operational policy rules, not secret cryptographic keys. A transparent JSON format allows users and administrators to inspect, audit, or reset policy manually via standard CLI tools. |
| **Separation of read and write privileges** | Coarse capability-level grants (e.g. `filesystem: *`) | Follows the principle of least privilege. An agent inspecting log files or scanning directory contents does not need and should not possess write or deletion authority. |
| **Lazy expiration on query** | Background timer sweeps | Avoids persistent timer intervals that keep Node/Bun event loops active and ensures authorization decisions reflect exact wall-clock time at evaluation moment. |

---

## Invariants and Guarantees

1. **Atomic One-Time Consumption**: Any permission evaluated under `'once'` scope is removed from `onceGrants` atomically before returning `true`. Subsequent checks for that resource will return `false` unless re-authorized.
2. **Persistence Boundary**: Only grants explicitly given the `'always'` scope are serialized to disk (`grants.json`). `'session'` and `'once'` grants reside solely in volatile memory and are cleared on process termination.
3. **Fail-Closed Default**: If a capability cannot be mapped to a known resource, or if no valid grant exists, `hasPermission()` strictly returns `false`. Privileges are never assumed.
4. **Idempotent Revocation**: Calling `revokePermission(resource)` clears the grant across all scopes (`once`, `session`, `always`) and immediately persists the updated state to disk.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Subsystem Recovery Behavior | What Recovery Intentionally Does NOT Do |
|---|---|---|---|
| **Corrupted grants file on disk** | `JSON.parse` failure in `loadPersistentGrants()` | Logs error, reinitializes persistent grants to empty map, backs up corrupted file. | Does not grant default permissions or compromise security posture. |
| **Disk write permission error** | `fs.writeFileSync` throws EACCES | Retains persistent grant in-memory for the current process; logs warning. | Does not crash execution pipeline. |
| **Expired grant query** | `Date.now() > grant.expiresAt` | Purges the expired entry immediately, persists cleanup to disk, returns `false`. | Does not prompt user automatically (delegated to Approval Gate). |
| **Unmapped capability string** | `mapCapabilityToResource` returns undefined | Throws or defaults to strictest check (`hasPermission` returns false). | Does not allow unmapped actions to proceed unvetted. |

---

## Things To Avoid

- **Do NOT bypass `hasPermission()` in capability adapters**: Every adapter method that interacts with the host filesystem, OS processes, or network must check permission prior to execution.
- **Do NOT grant `'always'` scope without explicit user consent**: Permanent grants survive process restarts; only use `'always'` when the user explicitly checks a "Remember this decision" option.
- **Do NOT store API keys or passwords in the permission manager**: Permissions govern access to capabilities; cryptographic credentials belong exclusively in `SecretVault`.
- **Do NOT reuse `'once'` tokens across multiple steps**: A `'once'` token is spent the instant it is checked.

---

---

## Where It Fits

The Permission Manager Subsystem resides in `packages/execution-core/src/security/permissions.ts` and acts as the gatekeeper for the execution runner and capability adapters.

```
+------------------------------------------------------------------------+
|                            Execution Runner                            |
+------------------------------------------------------------------------+
                                     |
                                     | 1. Evaluates task capability
                                     v
+------------------------------------------------------------------------+
|                          PermissionManager                             |
|  - mapCapabilityToResource(task.requiredCapability)                    |
|  - hasPermission(resource)                                             |
+------------------------------------------------------------------------+
     |                                                              |
     | If false                                                     | If true
     v                                                              v
+-----------------------------+               +--------------------------+
|        Approval Gate        |               |    Capability Adapter    |
| (Halts run & prompts user)  |               |  (Dispatches execution)  |
+-----------------------------+               +--------------------------+
     |
     | User Grants: 'once' | 'session' | 'always'
     v
+-----------------------------+
|    grant(res, scope, ttl)   |
+-----------------------------+
```

### Callers and Collaborators
- **Execution Runner**: Calls `mapCapabilityToResource()` and `hasPermission()` before dispatching any task.
- **Approval Gate**: Intercepts permission rejections, presents approval prompts to the user in the desktop UI, and calls `grant()` upon confirmation.
- **Tauri Desktop Settings**: Reads `listGrants()` to display the active permissions table and allows users to revoke grants via `revoke()`.

---

## Architecture

```
packages/execution-core/src/security/
  |-- permissions.ts   # PermissionManager, PermissionGrant, resource mappings
  `-- vault.ts         # SecretVault (encrypted credentials and keys)
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `PermissionManager` | Core security coordinator. Manages in-memory single-use and session grants, reads/writes persistent disk grants, and validates capability permissions. |
| `PermissionGrant` | Data contract tracking resource name, authorization scope, grant timestamp, and optional expiration. |
| `PermissionResource` | Union of guarded host resources. |
| `PermissionScope` | Lifetime scope indicator (`'once'`, `'session'`, `'always'`). |

---

## Core Concepts

### 1. Permission Scopes

| Scope | Lifetime | In-Memory / Disk | Typical Use Case |
| :--- | :--- | :--- | :--- |
| `once` | Consumed on first check | In-memory `Set<PermissionResource>` | Destructive file deletion, shell execution. |
| `session` | Duration of the active application run | In-memory `Map<PermissionResource, PermissionGrant>` | Bulk web scraping, reading workspace files. |
| `always` | Persisted across app restarts | Stored in `~/.usepilot/permissions/grants.json` | Core browser navigation, read-only directory paths. |

### 2. Resource Mapping Table

The `mapCapabilityToResource(capability)` method translates planner capabilities into security resources:

| Planner Capability (`TaskCapability`) | Required Permission (`PermissionResource`) |
| :--- | :--- |
| `navigate_website`, `search_web`, `extract_web_data`, `download_file`, `authenticate_user` | `browser` |
| `read_file` | `filesystem:read` |
| `write_file`, `move_file`, `delete_file` | `filesystem:write` |
| `read_clipboard` | `clipboard:read` |
| `write_clipboard` | `clipboard:write` |
| `execute_command` | `desktop:launch` |
| `call_api` | `network` |

If a capability is unknown or does not require restricted host privileges, `mapCapabilityToResource()` returns `undefined`, allowing the execution runner to proceed without approval gates.

---

## Data Flow

```
1. Task Dispatch Initiated
   runner.executeTask(task)
      |
      v
2. Resource Translation
   resource = permissions.mapCapabilityToResource(task.requiredCapability)
      |
      v
3. Permission Verification (hasPermission)
   - Step A: Check onceGrants.has(resource)
             If found: delete from Set -> Return true
   - Step B: Check sessionGrants.get(resource)
             If valid & unexpired: Return true
             If expired: delete from map
   - Step C: Check persistentGrants.get(resource)
             If valid & unexpired: Return true
             If expired: delete from map & persist to disk
   - Step D: Return false (Permission Denied)
      |
      v
4. Approval Gate Interaction (if false)
   - Execution halts
   - User prompted: "Allow task to write file config.json?"
   - User selects scope: 'session'
   - permissions.grant('filesystem:write', 'session')
      |
      v
5. Resume Execution
   runner re-evaluates hasPermission() -> returns true -> dispatches adapter
```

---

## Public API

### `PermissionManager`

Located in `packages/execution-core/src/security/permissions.ts`.

#### Constructor
```typescript
constructor(options?: PermissionManagerOptions | undefined)
```
`options.storagePath` overrides the default persistent file location (`~/.usepilot/permissions/grants.json`).

#### Evaluation & Mapping Methods
```typescript
// Map high-level planner capability to underlying security resource
mapCapabilityToResource(capability: TaskCapability): PermissionResource | undefined

// Check if resource is authorized; consumes 'once' grants atomically
hasPermission(resource: PermissionResource): boolean
```

#### Grant & Revoke Methods
```typescript
// Authorize a resource with specific scope and optional duration
grant(
  resource: PermissionResource,
  scope: PermissionScope,
  durationMs?: number | undefined
): void

// Revoke access to a resource across all scopes (once, session, always)
revoke(resource: PermissionResource): void

// Clear all 'once' and 'session' grants (retaining persistent grants)
resetSession(): void

// Clear all grants across all scopes and wipe persistent disk file
clearAll(): void

// Return list of all currently active grants across all scopes
listGrants(): PermissionGrant[]
```

---

## Internal Components

### 1. Persistent Storage Engine
Persistent grants are serialized as JSON:
```typescript
private persist(): void {
  const dir = dirname(this.storagePath)
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
  const plainJson = JSON.stringify(Object.fromEntries(this.persistentGrants), null, 2)
  writeFileSync(this.storagePath, plainJson, 'utf8')
}
```
If `load()` encounters a missing or corrupt JSON file, it recovers by initializing an empty `persistentGrants` map.

---

## Lifecycle

```
[Application Startup]
             |
             v
[PermissionManager Instantiated]
  - Reads ~/.usepilot/permissions/grants.json into persistentGrants
  - Initializes empty sessionGrants and onceGrants
             |
             v
[Workflow Execution Steps]
  - hasPermission() evaluates grants
  - 'once' grants consumed on access
  - Expired grants lazily purged
  - New grants saved via grant()
             |
             v
[Session Termination]
  - onceGrants and sessionGrants discarded from memory
  - persistentGrants remain intact on disk
```

---

## Error Handling

All filesystem persistence calls create parent directories recursively with `mkdirSync(dir, { recursive: true })`. If reading the persistent file fails due to syntax corruption, the error is caught and a clean empty grant map is established, preventing permission store corruption from halting the application.

---

## Thread Safety and Concurrency

- **Synchronous Atomic State**: All grant insertions, lookups, and single-use deletions occur synchronously within the single-threaded Node.js event loop.
- **Race-Free Consumption**: In `hasPermission()`, `'once'` tokens are deleted synchronously before the method returns `true`, guaranteeing that concurrent async execution ticks cannot reuse the same token.

---

## Performance Characteristics

| Operation | Complexity | Latency |
| :--- | :--- | :--- |
| `hasPermission(resource)` | O(1) | Sub-microsecond Set/Map lookup. |
| `mapCapabilityToResource()` | O(1) | Switch statement lookup. |
| `grant(..., 'once' \| 'session')` | O(1) | In-memory insertion. |
| `grant(..., 'always')` | O(G) where G = persistent grants | Synchronous JSON serialization + file write (~1 ms). |
| `listGrants()` | O(G) | Flattens grant maps into array. |

---

## Testing Strategy

Tests reside in `packages/execution-core/test/permissions.test.ts`:

- **Single-Use Consumption**: Grants `'once'` access to `filesystem:write`. First `hasPermission()` call returns `true`; immediate second call returns `false`.
- **TTL Expiration**: Creates a session grant with a 50ms TTL, waits 60ms, and verifies `hasPermission()` returns `false`.
- **Disk Persistence Round-Trip**: Grants `'always'` access, instantiates a new `PermissionManager` targeting the same storage path, and verifies the grant is loaded properly.
- **Capability Mapping**: Verifies that every capability in `TaskCapability` maps to the expected resource or returns `undefined`.

---

## Extension Guide

### Adding a New Guarded Resource

1. Add the resource literal to `PermissionResource` in `packages/execution-core/src/security/permissions.ts`:
   ```typescript
   export type PermissionResource =
     | 'browser'
     // ...
     | 'system:power' // e.g. shutdown / reboot
   ```
2. Update `mapCapabilityToResource` to map relevant task capabilities to the new resource.

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **`onceGrants`** | `PermissionManager` | `grant(..., 'once')`, `hasPermission()` (consumes) | Capability checks | Single check | Volatile Set in memory |
| **`sessionGrants`** | `PermissionManager` | `grant(..., 'session')` | Capability checks | Process runtime or TTL | Volatile Map in memory |
| **`persistentGrants`** | `PermissionManager` | `grant(..., 'always')` | Capability checks | Multi-session | `~/.usepilot/permissions/grants.json` |

---

## Failure Assumptions

1. **Fail-Closed Security**: Assumes unauthorized access must be denied by default if capability mapping or authorization lookup fails.
2. **Atomic Single-Use Check**: Assumes `once` grants must be cleared from memory immediately upon evaluation to prevent replay or race exploitation.
3. **Local Storage Integrity**: Assumes `~/.usepilot/permissions/grants.json` is protected by standard OS file permissions for the current user.

---

## Common Extension Points

- **Adding a New Security Resource**: Extend `SecurityResource` in `packages/execution-core/src/security/permissions.ts` and add mapping logic in `mapCapabilityToResource()`.
- **Custom Policy Hooks**: Integrate pre-authorization audit hooks on `grant()` to enforce corporate compliance rules or time-of-day restrictions.

---

## Directory Layout

```
packages/execution-core/src/security/
├── permissions.ts   # PermissionManager, scopes, and resource mappings
└── vault.ts         # SecretVault for credential and token encryption
```

---

## Examples

### 1. Authorizing and Checking a Single-Use Permission
```typescript
import { PermissionManager } from '@usepilot/execution-core'

const permissions = new PermissionManager()

// Grant single-use access to write to the filesystem
permissions.grant('filesystem:write', 'once')

console.log(permissions.hasPermission('filesystem:write')) // true (consumed)
console.log(permissions.hasPermission('filesystem:write')) // false (already used)
```

### 2. Setting a Time-Limited Session Grant
```typescript
// Authorize clipboard reading for 10 minutes (600,000 ms)
permissions.grant('clipboard:read', 'session', 600000)

if (permissions.hasPermission('clipboard:read')) {
  // Safe to read clipboard
}
```

### 3. Capability Gating in an Execution Runner
```typescript
const resource = permissions.mapCapabilityToResource(task.requiredCapability)

if (resource && !permissions.hasPermission(resource)) {
  // Halt execution and request user approval
  const granted = await approvalGate.requestApproval({
    task,
    resource,
    reason: `Task "${task.title}" requires permission to access ${resource}.`,
  })

  if (!granted) {
    throw new Error(`Permission denied for resource: ${resource}`)
  }
}
```

---

## Related Documentation

- [Secret Vault Subsystem](../secrets/README.md) - Encrypted credential and token storage.
- [Filesystem Adapter Documentation](../filesystem/README.md) - Governed by `filesystem:read` and `filesystem:write`.
- [Desktop Adapter Subsystem](../desktop/README.md) - Governed by `desktop:launch` and `clipboard:*`.
- [Browser Subsystem Documentation](../browser/README.md) - Governed by `browser` permissions.
