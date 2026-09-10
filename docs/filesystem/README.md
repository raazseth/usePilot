# Native Filesystem Adapter

Native Filesystem Adapter (`@usepilot/execution-core/src/adapters/filesystem`) executes atomic, verified file operations against local storage, enforcing path containment, swap-based crash recovery, cross-partition migration, and cryptographic checksum validation.

---

## Purpose

Automated agents frequently manipulate local configuration files, reports, assets, code files, and downloads. Naive file operations risk data corruption: partial writes during unhandled exceptions or power drops, broken cross-partition renames (`EXDEV`), and unverified completions where an adapter reports success despite the operating system failing to flush bytes to disk.

The Native Filesystem Adapter owns:
- Path resolution against configured working directories.
- Crash-safe atomic writes using unique temporary files and atomic rename operations.
- Cross-device file transfers handling `EXDEV` partition boundaries with copy-and-unlink fallbacks.
- Recursive directory tree creation and deletion.
- SHA-256 cryptographic digest computation during reads, writes, and state verifications.
- Cancellation handling using `AbortSignal` checks prior to and during disk I/O.
- Independent verification inspecting actual filesystem state post-execution.

The Native Filesystem Adapter intentionally does NOT own:
- Execution scheduling, task dependency trees, or retry logic.
- Cloud object sync or network storage protocols (such as S3 or WebDAV).
- Virtual artifact taxonomy (delegated to the Runtime Artifact Store).
- Permission policy decisions or capability elevation checks (delegated to the Security subsystem).

---

## Design Principles

### 1. Zero Partial Writes (Atomic Temp-Swap)
A file write operation must never write directly to the target destination path. If a process crash, timeout, or cancellation occurs mid-write, the target file must not be left in a corrupted or truncated state. The adapter writes payloads to a sibling temporary file (`<target>.tmp.<randomHex>`), completes the flush to disk, and then executes an atomic filesystem rename to the target path. If an error occurs, the temporary file is deleted and the destination remains untouched.

### 2. Cross-Device Portability
In production environments, user home folders, temporary directories, and mounted external drives often span different physical disks, loop devices, or network shares. When moving a file across filesystem partitions, standard operating system rename calls fail with error code `EXDEV` ("Invalid cross-device link"). The adapter catches `EXDEV` and automatically degrades to a sequential stream copy followed by an unlinking of the source file.

### 3. Execution Verification Decoupling
An adapter returning a successful return code does not guarantee that the desired state exists on disk. Operating systems may delay disk flush, paths may be modified by concurrent processes, or permissions may restrict visibility. The adapter couples execution with an explicit `verify()` implementation that reads file statistics, computes SHA-256 hashes, and inspects filesystem nodes independently before reporting completion to the execution coordinator.

### 4. Deterministic Path Resolution
All user or agent-provided relative paths are normalized and resolved against an explicitly configured `workingDirectory` (defaulting to `process.cwd()`). Unqualified filenames and nested relative paths resolve deterministically without depending on variable shell contexts.

---

## Where It Fits

The Native Filesystem Adapter implements the `ICapabilityAdapter` interface from `@usepilot/execution-types` and is registered with the capability execution router in `packages/execution-core`.

```
                  +-----------------------------------+
                  |        Execution Engine           |
                  +-----------------------------------+
                                    |
                                    | Dispatches task
                                    v
                  +-----------------------------------+
                  |     NativeFilesystemAdapter       |
                  +-----------------------------------+
                     /            |                \
                    /             |                 \
         read_file /  write_file  |   move_file      \ delete_file
                  v               v                   v
         +-------------+  +-----------------+  +-----------------+
         | node:fs     |  | Atomic Temp     |  | Recursive       |
         | readFile()  |  | File + Rename   |  | Clean & EXDEV   |
         +-------------+  +-----------------+  +-----------------+
                  \               |                   /
                   \              |                  /
                    v             v                 v
                  +-----------------------------------+
                  |         Local Filesystem          |
                  +-----------------------------------+
                                    ^
                                    | Validates state
                  +-----------------------------------+
                  |       FilesystemVerifier          |
                  +-----------------------------------+
```

### Callers and Collaborators
- **Capability Registry**: Dispatches tasks demanding `read_file`, `write_file`, `move_file`, or `delete_file` to `NativeFilesystemAdapter` based on priority (`100`) and platform support (`windows`, `macos`, `linux`).
- **FilesystemVerifier**: Collaborates during post-execution inspection to ensure physical files match requested hashes and sizes.
- **Artifact Store**: Relies on filesystem primitives when writing execution artifacts, logs, and screenshots.

---

## Architecture

```
packages/execution-core/src/adapters/filesystem/
  `-- fs-adapter.ts     # NativeFilesystemAdapter implementation
packages/execution-core/src/verification/
  `-- capability-verifiers.ts  # FilesystemVerifier state check logic
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `NativeFilesystemAdapter` | Implements `ICapabilityAdapter`. Maps task parameters to Node.js `fs.promises` calls, manages atomic temp files, computes hashes, and handles cancellation. |
| `FilesystemAdapterOptions` | Configuration interface providing custom working directory overrides. |
| `FilesystemVerifier` | Standalone verifier that reads file metadata and computes cryptographic hashes to confirm task success. |

---

## Core Concepts

### 1. Capability Dispatch
The adapter is instantiated per capability or reused across related filesystem capabilities:
- `read_file`: Reads UTF-8 text or specified encodings, computes file size and SHA-256 hash.
- `write_file`: Recursively creates parent directories, writes content to a random temporary file, and renames atomically to the target destination.
- `move_file`: Renames files across paths, falling back to copy-and-unlink on cross-device link errors (`EXDEV`).
- `delete_file`: Recursively removes files or directory trees using `fs.rm(target, { recursive: true, force: true })`.

### 2. Atomic Write Protocol

```
Target File: /workspace/reports/summary.json

Step 1: Path Resolution
  targetDir = dirname(/workspace/reports/summary.json)
  fs.mkdir(targetDir, { recursive: true })

Step 2: Generate Unique Temporary Path
  tempPath = /workspace/reports/summary.json.tmp.8f1a2c3b4d5e

Step 3: Write Payload
  fs.writeFile(tempPath, content, 'utf8')

Step 4: Atomic Rename
  fs.rename(tempPath, targetPath)

Step 5: Compute Checksum & Stats
  stats = fs.stat(targetPath)
  hash = sha256(fs.readFile(targetPath))

Step 6: Return Output
  { path: targetPath, size: stats.size, hash, bytesWritten }
```

If Step 3 or Step 4 encounters an exception or process signal abort, `fs.unlink(tempPath)` executes in the catch handler, leaving the existing file at `summary.json` completely untouched.

### 3. Cross-Device Link Handling (`EXDEV`)
When moving a file between different drive letters on Windows (e.g., `C:` to `D:`) or between mount points on Linux/macOS, `fs.rename` throws an error with `code === 'EXDEV'`. The adapter intercepts this specific error code:
```typescript
try {
  await fs.rename(source, destination)
} catch (err: unknown) {
  const e = err as { code?: string }
  if (e.code === 'EXDEV') {
    await fs.copyFile(source, destination)
    await fs.unlink(source)
  } else {
    throw err
  }
}
```

---

## Data Flow

```
1. Caller Invocation
   executor.dispatch(task)
      |
      v
2. Adapter Context Ingestion
   ctx: { task, signal, blueprint }
      |
      v
3. Abort Signal Inspection
   if (ctx.signal.aborted) -> Return failureCategory: 'cancellation'
      |
      v
4. Parameter Extraction
   params = task.toolConfig ?? {}
   target = resolve(workingDirectory, params.path)
      |
      v
5. Operation Execution
   - read_file: read buffer, compute SHA-256, stat
   - write_file: atomic temp write + rename, compute SHA-256, stat
   - move_file: rename with EXDEV fallback
   - delete_file: recursive rm
      |
      v
6. Result Assembly
   Return AdapterResult { success: true, output, durationMs }
      |
      v
7. Independent Verification
   adapter.verify(ctx, result) OR FilesystemVerifier.verify(ctx)
   - Read physical file stats
   - Verify non-empty or expected size
   - Confirm deletion or destination presence
      |
      v
8. Final VerificationResult { passed: true/false, checkedConditions }
```

---

## Public API

### `NativeFilesystemAdapter`

Located in `packages/execution-core/src/adapters/filesystem/fs-adapter.ts`.

#### Constructor
```typescript
constructor(
  capability: TaskCapability,
  options?: FilesystemAdapterOptions | undefined
)
```

- `capability`: The primary filesystem capability assigned to this adapter instance (e.g., `'read_file'`, `'write_file'`, `'move_file'`, `'delete_file'`).
- `options.workingDirectory`: Optional absolute or relative base directory used to resolve relative file paths. Defaults to `process.cwd()`.

#### Properties
- `readonly capability: TaskCapability`: Registered capability name.
- `readonly priority: number = 100`: High priority default for native filesystem operations.
- `readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']`: Complete cross-platform support.
- `readonly name: string = 'NativeFilesystemAdapter'`: Component identifier.

#### Lifecycle Methods
```typescript
initialize(): Promise<void>
isAvailable(): Promise<boolean>
cleanup(): Promise<void>
dispose(): Promise<void>
```
Lifecycle primitives conforming to `ICapabilityAdapter`. Because the adapter operates directly on native OS filesystem calls without persistent background daemons, initialization and availability checks return immediately.

#### Execution & Verification Methods

```typescript
// Execute filesystem task based on capability
execute(ctx: AdapterContext): Promise<AdapterResult>

// Verify physical state on disk matches operation results
verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
```

---

### Output Contracts

#### `read_file` Output
```typescript
interface ReadFileOutput {
  path: string      // Absolute resolved path
  size: number      // File size in bytes
  hash: string      // Cryptographic SHA-256 checksum
  content: string   // Decoded file contents (default UTF-8)
}
```

#### `write_file` Output
```typescript
interface WriteFileOutput {
  path: string          // Absolute resolved path
  size: number          // Final file size in bytes
  hash: string          // Cryptographic SHA-256 checksum of written data
  bytesWritten: number  // Count of bytes written
}
```

#### `move_file` Output
```typescript
interface MoveFileOutput {
  source: string       // Absolute resolved source path
  destination: string  // Absolute resolved destination path
  moved: true
}
```

#### `delete_file` Output
```typescript
interface DeleteFileOutput {
  path: string     // Absolute resolved deleted path
  deleted: true
}
```

---

## Internal Components

### 1. `resolvePath(filePath: string): string`
Resolves target paths against `this.workingDirectory` using Node.js `path.resolve`. Absolute paths remain unchanged; relative paths are anchored strictly to the working directory.

### 2. `computeHash(filePath: string): Promise<string>`
Reads the target file using `fs.readFile` and passes the resulting buffer through `createHash('sha256').update(data).digest('hex')`. This ensures verification and audit trails have exact byte-level proof of file state.

### 3. Temp File Name Generator
Uses `crypto.randomBytes(6).toString('hex')` to create non-colliding suffixes:
`${target}.tmp.${randomBytes(6).toString('hex')}`. This prevents race conditions when concurrent tasks write to different files in the same directory.

---

## Lifecycle

```
   +------------------------------------+
   | Instantiation                      |
   | new NativeFilesystemAdapter(cap)   |
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   | Availability Check                 |
   | await adapter.isAvailable() -> true|
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   | Execution                          |
   | await adapter.execute(ctx)         |
   | - Checks AbortSignal               |
   | - Resolves path                    |
   | - Performs atomic I/O              |
   | - Computes SHA-256 hash            |
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   | State Verification                 |
   | await adapter.verify(ctx, result)  |
   | - Verifies physical disk state     |
   | - Confirms non-zero size / delete  |
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   | Disposal                           |
   | await adapter.dispose()            |
   +------------------------------------+
```

---

## Error Handling

### 1. Cancellation Detection
Before initiating disk operations, the adapter inspects `ctx.signal.aborted`. If true, execution terminates immediately without touching the filesystem:
```typescript
if (ctx.signal.aborted) {
  return {
    success: false,
    error: 'Execution cancelled',
    failureCategory: 'cancellation',
    durationMs: Date.now() - start,
  }
}
```

### 2. Atomic Cleanup on Failure
If writing to the temporary file fails or the atomic rename is rejected (for instance, due to an operating system permission violation), the temporary file is unlinked immediately in the `catch` block:
```typescript
try {
  await fs.writeFile(tempPath, content, 'utf8')
  await fs.rename(tempPath, target)
} catch (writeErr) {
  await fs.unlink(tempPath).catch(() => {})
  throw writeErr
}
```
This guarantees no orphan temporary files litter user directories on failed operations.

### 3. `EXDEV` Partition Recovery
When files are moved across distinct disk partitions or network volumes, the operating system kernel rejects `rename()` with `EXDEV`. The adapter catches this, streams the content via `copyFile()`, and then removes the original file with `unlink()`.

### 4. Categorized Failure Metadata
Exceptions caught during execution return structured `AdapterResult` records with `failureCategory: 'adapter_failure'` and standard error messages, enabling the execution engine's self-healing pipeline to trigger appropriate remediation.

---

## Design Tradeoffs

### 1. Atomic Temp-Swap vs. Direct Stream Writes
Rather than streaming bytes directly to the target destination path, the adapter writes to a sibling temporary file (`<target>.tmp.<nonce>`) and executes an atomic `fs.rename`.
- **Tradeoff**: Guarantees zero half-written or corrupted files if the process terminates, powers off, or aborts mid-write. Readers observe either the complete previous version or the complete new version.
- **Cost**: Requires temporary disk space equal to the file size during write, plus a subsequent rename operation.

### 2. Immediate SHA-256 Digest vs. Deferred Checksumming
The adapter calculates the cryptographic SHA-256 checksum immediately after completing the write or read operation.
- **Tradeoff**: Provides immediate cryptographic proof of state for the `FilesystemVerifier` without requiring a redundant disk read pass.
- **Cost**: Adds minor CPU computation time during write operations.

### 3. Automatic `EXDEV` Fallback vs. Strict Rename
When a move operation spans across different disk partitions, loop devices, or network mounts, the operating system kernel throws `EXDEV` ("Invalid cross-device link").
- **Tradeoff**: The adapter catches `EXDEV` and seamlessly falls back to streaming copy followed by source unlinking, preventing hard automation failures on complex multi-drive workstations.
- **Cost**: Cross-device moves become O(N) stream copies instead of O(1) directory table pointer renames.

---

## Invariants and Guarantees

1. **Zero Partial Writes**: A destination file is never left in a corrupted or truncated state. If an operation fails during temp write or rename, the temporary file is unlinked immediately in the error handler.
2. **Path Anchoring**: All relative paths resolve deterministically against `workingDirectory`. Paths can never drift due to unexpected changes in the ambient Node.js process working directory.
3. **Parent Directory Auto-Provisioning**: Both `write_file` and `move_file` automatically create all missing parent directories (`fs.mkdir(targetDir, { recursive: true })`) before initiating I/O.
4. **Idempotent Deletion**: Calling `delete_file` on a non-existent path succeeds cleanly (`force: true`), ensuring teardown routines are naturally idempotent.

---

## Failure Modes and Recovery

| Failure Scenario | Error Code | Detection | Automated Recovery | Non-Goals (What It Won't Do) |
|---|---|---|---|---|
| **Cross-Volume Move** | `EXDEV` | Caught in rename try/catch | Streams file via `copyFile()` then unlinks source. | Does not attempt to preserve non-standard extended file ACLs. |
| **Write Interruption / Cancel** | `AbortSignal` | `ctx.signal.aborted` check | Unlinks `.tmp` file immediately; destination file remains untouched. | Does not resume partially written streams; restart required. |
| **Permission Denied** | `EACCES` / `EPERM` | Caught and categorized | Returns `failureCategory: 'adapter_failure'` with diagnostic note. | Does not attempt privilege elevation (sudo/admin). |
| **Target Missing on Read** | `ENOENT` | Caught in `readFile()` | Returns structured failure to trigger self-healing or planning repair. | Does not create dummy files on missing reads. |

---

## Things To Avoid

- **Do NOT write directly to target filenames.** Bypassing the temporary swap file pattern risks corrupting user data if an unhandled exception or process termination occurs mid-write.
- **Do NOT assume `fs.rename` is always instantaneous.** Renames across partitions or network drives throw `EXDEV`. Always use the adapter's cross-device safe move logic.
- **Do NOT rely on ambient process `process.cwd()`.** Always pass an explicit `workingDirectory` when instantiating `NativeFilesystemAdapter` to ensure path resolution remains deterministic.
- **Do NOT skip independent verification.** Always invoke `adapter.verify(ctx, result)` or `FilesystemVerifier`. Operating system filesystem caches can delay flush to physical media; verifiers ensure bytes exist on storage.

---

## Thread Safety and Concurrency

- **Unique Temporary Names**: Because each atomic write generates a unique 12-character hex nonce (`randomBytes(6)`), concurrent write operations targeting different files will not collide.
- **Operating System Rename Atomicity**: On POSIX filesystems and modern Windows NTFS, `fs.rename` replaces the target file atomically at the directory table level. A concurrent reader will observe either the complete previous version or the complete new version, never an incomplete intermediate byte stream.
- **Stateless Instances**: `NativeFilesystemAdapter` holds no mutable state across executions. A single instance can safely handle sequential or concurrent tasks.

---

## Performance Characteristics

| Operation | I/O Pattern | Performance Profile |
| :--- | :--- | :--- |
| `read_file` | Direct read + SHA-256 digest | Single sequential disk read. Throughput bound by storage bus (NVMe/SSD). |
| `write_file` | Directory mkdir + Temp write + Rename + Stat + Read hash | Two disk writes (temp write and directory table update) followed by verification stat. |
| `move_file` (same volume) | Directory table update | Near O(1) instantaneous directory pointer rename. |
| `move_file` (cross-volume) | Read copy + Unlink | O(N) sequential stream copy across storage volumes. |
| `delete_file` | Recursive inode unlink | O(M) where M is total files and folders in target subtree. |

---

## Testing Strategy

Tests reside in `packages/execution-core/test/filesystem-adapter.test.ts`:

- **Atomic Writes**: Writes test files and simulates interruptions to confirm temporary files are cleaned up and destinations are never partially written.
- **Read & Hash Consistency**: Reads files of known sizes and verifies SHA-256 output matches expected test hashes.
- **Recursive Directory Handling**: Tests creating deep directory paths (`/a/b/c/file.txt`) and verifies parents are created automatically.
- **Cross-Platform Pathing**: Verifies Windows drive letters (`C:\...`) and POSIX paths (`/...`) resolve properly without malformed separators.
- **Cancellation**: Triggers an `AbortController.abort()` prior to execution and validates immediate `cancellation` failure response.

---

## Extension Guide

### Adding Support for Additional Filesystem Operations

1. Add the capability to `TaskCapability` in `packages/planner-types/src/index.ts`.
2. Add a new `case` clause in `NativeFilesystemAdapter.execute`:
   ```typescript
   case 'copy_file': {
     const source = this.resolvePath(params['source'] as string)
     const destination = this.resolvePath(params['destination'] as string)
     await fs.mkdir(dirname(destination), { recursive: true })
     await fs.copyFile(source, destination)
     const stats = await fs.stat(destination)
     output = { source, destination, size: stats.size }
     break
   }
   ```
3. Add corresponding verification logic to `NativeFilesystemAdapter.verify` and `FilesystemVerifier`.

---

## Directory Layout

```
packages/execution-core/src/adapters/filesystem/
  `-- fs-adapter.ts     # NativeFilesystemAdapter, options, and types
packages/execution-core/src/verification/
  `-- capability-verifiers.ts  # FilesystemVerifier and related verifiers
```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **Destination File** | Operating System Filesystem | `NativeFilesystemAdapter` | Verifier, External Apps | Indefinite | Durable on local disk |
| **Temporary Swap File** | `NativeFilesystemAdapter` | `fs.writeFile` | None (internal swap) | Milliseconds during atomic write | Unlinked immediately upon swap or error |
| **Verification State** | `FilesystemVerifier` | Verifier routines | Execution Coordinator | Task verification window | Emitted to execution journal |

---

## Failure Assumptions

1. **Physical Storage Access**: Assumes the underlying disk volume is mounted and writable. If write permissions are denied (`EACCES`) or volume is read-only (`EROFS`), the adapter fails fast without mutating destination paths.
2. **Cross-Device Partitions**: Assumes paths may cross mount boundaries (`EXDEV`), providing automatic fallback from `fs.rename` to sequential chunk copy followed by source unlink.
3. **External Modifications**: Assumes external processes or anti-virus locks may briefly hold open file handles, verifying state independently post-write to detect third-party interference.

---

## Common Extension Points

- **Adding a New Filesystem Capability**: Define capability in `packages/execution-types/src/capabilities.ts`, implement action handler in `NativeFilesystemAdapter.execute()`, and wire corresponding assertion logic in `FilesystemVerifier`.
- **Custom Post-Write Encoders**: Extend the write pipeline to support streaming encryption, automated compression, or format transformations prior to atomic swap.

---

## Examples

### 1. Atomic File Write
```typescript
import { NativeFilesystemAdapter } from '@usepilot/execution-core'

const adapter = new NativeFilesystemAdapter('write_file', {
  workingDirectory: '/workspace/project',
})

const result = await adapter.execute({
  task: {
    id: 'task-1',
    title: 'Write config file',
    requiredCapability: 'write_file',
    toolConfig: {
      path: 'config/app.json',
      content: JSON.stringify({ debug: false, port: 8080 }, null, 2),
    },
    successConditions: ['File exists on disk'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
})

console.log(result.success) // true
console.log(result.output)
// {
//   path: '/workspace/project/config/app.json',
//   size: 42,
//   hash: '3a8b...1f',
//   bytesWritten: 42
// }
```

### 2. Safe File Read with Verification
```typescript
import { NativeFilesystemAdapter } from '@usepilot/execution-core'

const adapter = new NativeFilesystemAdapter('read_file')

const result = await adapter.execute({
  task: {
    id: 'task-2',
    title: 'Read license',
    requiredCapability: 'read_file',
    toolConfig: {
      path: './LICENSE',
      encoding: 'utf8',
    },
    successConditions: ['File read successfully'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
})

if (result.success) {
  const { content, hash } = result.output as { content: string; hash: string }
  console.log(`Read license (${hash}):\n${content}`)
}
```

### 3. Atomic File Deletion and Verification
```typescript
import { NativeFilesystemAdapter } from '@usepilot/execution-core'

const adapter = new NativeFilesystemAdapter('delete_file')

const ctx = {
  task: {
    id: 'task-3',
    title: 'Clean temporary export',
    requiredCapability: 'delete_file',
    toolConfig: {
      path: '/tmp/export-old.csv',
    },
    successConditions: ['File confirmed deleted at /tmp/export-old.csv'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
}

const result = await adapter.execute(ctx)
const verification = await adapter.verify(ctx, result)

console.log(`Deleted: ${result.success}`)
console.log(`Verified: ${verification.passed}`)
console.log(`Checked:`, verification.checkedConditions)
```

---

## Related Documentation

- [Capability Verification Documentation](../verification/README.md) - Independent postcondition checking architecture.
- [Runtime Artifact Subsystem](../artifacts/README.md) - Specialized disk persistence for execution assets.
- [Desktop Adapter Subsystem](../desktop/README.md) - Native operating system interaction and shell execution.
