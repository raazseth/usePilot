# Capability Verification Subsystem

Capability Verification (`@usepilot/execution-core/src/verification`) validates post-execution environment states across browser, filesystem, and desktop layers, enforcing the invariant that adapter execution success is not equivalent to task completion.

---

## Purpose

Automated agents that execute actions against web pages, local operating systems, and file systems can experience false positives. An adapter may successfully dispatch an HTTP click event, shell command, or filesystem write call, yet the underlying system may fail to transition to the intended state:
- A navigation command returns HTTP 200, but lands on an error page or remains stuck on `about:blank`.
- A file download event is triggered, but the browser encounters an interrupted network socket and saves a zero-byte stub.
- A file deletion command executes without an exception, but the file remains locked by another process and is not unlinked.
- A write operation finishes, but file permissions prevent disk flushing.

The Capability Verification Subsystem owns:
- Decoupled, out-of-band verification of execution postconditions.
- Capability-specific verifiers (`BrowserStateVerifier`, `FilesystemVerifier`, `DesktopStateVerifier`).
- Physical state inspection: live URL validation, file existence, size checks, cryptographic SHA-256 validation, and deletion confirmation.
- Structured condition tracking (`checkedConditions` vs. `failedConditions`).
- Timing and duration tracking for verification phases.

The Capability Verification Subsystem intentionally does NOT own:
- Action dispatch or tool execution (owned by capability adapters).
- Failure remediation or retry strategy selection (owned by the Self-Healing pipeline).
- Execution planning or task decomposition (owned by the Planner).

---

## Design Principles

### 1. Verification Decoupled from Execution
Adapters are biased observers of their own execution. If an adapter contains a defect, a timeout misconfiguration, or an unhandled edge case, asking the same adapter code to self-evaluate without independent inspection leads to silent failures. Verification logic is separated into distinct verifier classes (`ICapabilityVerifier`) that independently query the operating system, disk, and browser session.

### 2. Physical State Proof over Return Codes
A step is verified only when physical proof of the state change is validated:
- `write_file`: The file must exist on disk, have non-negative size, and produce a valid SHA-256 checksum.
- `delete_file`: An attempt to `fs.stat` the target path must throw an `ENOENT` error.
- `download_file`: The downloaded file must exist at the target path on disk with a byte count greater than zero.
- `navigate_website`: The browser session must report a valid, non-empty URL different from `about:blank`.

### 3. Explicit Condition Tracking
Verifiers do not return a simple boolean. Every evaluation produces a comprehensive `VerificationResult` containing arrays of `checkedConditions` (what was verified to be true) and `failedConditions` (what assertions failed). This structured record allows self-healing and diagnostic engines to understand exactly why a verification failed.

---

## Where It Fits

The Capability Verification Subsystem resides in `packages/execution-core/src/verification/` and is exported directly from `@usepilot/execution-core`.

```
                        +----------------------------------+
                        |         Execution Runner         |
                        +----------------------------------+
                                          |
                                          | 1. Execute Task
                                          v
                        +----------------------------------+
                        |       Capability Adapter         |
                        | (Browser / Filesystem / Desktop) |
                        +----------------------------------+
                                          |
                                          | 2. AdapterResult
                                          v
                        +----------------------------------+
                        |        Verifier Context          |
                        |   { task, blueprint, result }    |
                        +----------------------------------+
                                          |
                                          | 3. Independent State Check
                                          v
                        +----------------------------------+
                        |      ICapabilityVerifier         |
                        +----------------------------------+
                           /              |              \
                          /               |               \
                         v                v                v
                 +---------------+ +--------------+ +---------------+
                 | BrowserState  | |  Filesystem  | | DesktopState  |
                 |   Verifier    | |   Verifier   | |   Verifier    |
                 +---------------+ +--------------+ +---------------+
                         |                |                |
                         | Inspects DOM   | Checks Disk    | Checks System
                         v & Network      v & SHA-256      v & Clipboard
                 +---------------+ +--------------+ +---------------+
                 | Live Browser  | | Local Storage| | Host OS       |
                 +---------------+ +--------------+ +---------------+
                                          |
                                          | 4. VerificationResult
                                          v
                        +----------------------------------+
                        |       Self-Healing Engine        |
                        |   (Pass -> Next / Fail -> Heal)  |
                        +----------------------------------+
```

### Callers and Collaborators
- **Execution Runner**: Invocates the appropriate verifier immediately after an adapter completes `execute()`.
- **Self-Healing Engine**: Reads `VerificationResult.failedConditions` to select a recovery strategy (e.g. locator re-probing, alternative navigation, retry with backoff).
- **Execution Timeline**: Records `VerificationResult` objects into the execution history for auditing and replay.

---

## Architecture

```
packages/execution-core/src/verification/
  `-- capability-verifiers.ts  # ICapabilityVerifier, VerifierContext, and concrete verifiers
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `ICapabilityVerifier` | Core interface defining the `verify(ctx: VerifierContext): Promise<VerificationResult>` contract. |
| `VerifierContext` | Context passed to verifiers containing the `Task`, the overall `ExecutionBlueprint`, and the raw `AdapterResult`. |
| `BrowserStateVerifier` | Validates browser operations: URLs, downloads on disk, and extracted text outputs. |
| `FilesystemVerifier` | Validates file operations: reads files, checks non-zero lengths, verifies SHA-256 hashes, and asserts unlinking. |
| `DesktopStateVerifier` | Validates desktop operations: command execution results, application launch status, and clipboard consistency. |

---

## Core Concepts

### 1. The Verification Result Contract

Every verifier returns a typed `VerificationResult` from `@usepilot/execution-types`:

```typescript
export interface VerificationResult {
  passed: boolean
  checkedConditions: string[]
  failedConditions: string[]
  strategy: 'state_check' | 'visual_check' | 'llm_judge'
  durationMs: number
  notes?: string | undefined
}
```

- `passed`: `true` if and only if `failedConditions.length === 0`.
- `checkedConditions`: Human-readable assertions that successfully passed.
- `failedConditions`: Explanations of every condition that failed.
- `strategy`: The strategy used to verify (`'state_check'` for all code-based state verifiers).
- `durationMs`: Total time spent performing the verification.
- `notes`: Optional error messages or execution diagnostic notes.

### 2. Verifier Selection Matrix

| Capability Category | Target Capability | Verifier Class | Checks Performed |
| :--- | :--- | :--- | :--- |
| **Browser** | `navigate_website`, `search_web` | `BrowserStateVerifier` | Asserts output URL is defined, non-empty, and not `about:blank`. |
| **Browser** | `download_file` | `BrowserStateVerifier` | Asserts `downloaded === true`, stats target file path on disk, checks `size > 0`. |
| **Browser** | `extract_web_data` | `BrowserStateVerifier` | Asserts output text exists and length > 0. |
| **Filesystem** | `write_file` | `FilesystemVerifier` | Stats file on disk (`size >= 0`), reads bytes, computes SHA-256 checksum. |
| **Filesystem** | `delete_file` | `FilesystemVerifier` | Invokes `fs.stat(path)` and confirms an error is thrown (file does not exist). |
| **Filesystem** | `move_file` | `FilesystemVerifier` | Stats destination path and confirms it is a file or directory. |
| **Desktop** | `write_clipboard`, `execute_command` | `DesktopStateVerifier` | Confirms execution success and asserts task success conditions. |

---

## Data Flow

```
1. Task Finishes Execution
   AdapterResult { success: true, output: { path: '/tmp/report.pdf', downloaded: true } }
      |
      v
2. Construct Verifier Context
   ctx = {
     task: { requiredCapability: 'download_file', ... },
     blueprint,
     result
   }
      |
      v
3. Dispatch to Verifier
   verifier = new BrowserStateVerifier()
   verifier.verify(ctx)
      |
      v
4. State Inspection
   - Is result.success === true? (Yes)
   - Is output.downloaded === true? (Yes)
   - Does file exist at /tmp/report.pdf? (fs.stat)
   - Is file size > 0 bytes? (Yes, 412,890 bytes)
      |
      v
5. Assemble VerificationResult
   checkedConditions = ['Downloaded file confirmed on disk (412890 bytes)']
   failedConditions = []
   passed = true
   durationMs = 4
      |
      v
6. Route to Engine
   If passed === true  -> Mark task SUCCEEDED -> Continue execution
   If passed === false -> Mark task FAILED    -> Trigger Self-Healing Pipeline
```

---

## Public API

### `ICapabilityVerifier`

Located in `packages/execution-core/src/verification/capability-verifiers.ts`.

```typescript
export interface VerifierContext {
  task: Task
  blueprint: ExecutionBlueprint
  result: AdapterResult
}

export interface ICapabilityVerifier {
  verify(ctx: VerifierContext): Promise<VerificationResult>
}
```

---

### Concrete Verifiers

#### `BrowserStateVerifier`
```typescript
export class BrowserStateVerifier implements ICapabilityVerifier {
  verify(ctx: VerifierContext): Promise<VerificationResult>
}
```
Inspects browser state post-execution. Evaluates navigation target URLs, validates that downloaded files exist with positive size on disk, and confirms extracted text is non-empty.

#### `FilesystemVerifier`
```typescript
export class FilesystemVerifier implements ICapabilityVerifier {
  verify(ctx: VerifierContext): Promise<VerificationResult>
}
```
Inspects local filesystem nodes post-execution. For write operations, verifies existence and computes a SHA-256 checksum. For delete operations, asserts that the target node is gone. For move operations, asserts that the destination exists.

#### `DesktopStateVerifier`
```typescript
export class DesktopStateVerifier implements ICapabilityVerifier {
  verify(ctx: VerifierContext): Promise<VerificationResult>
}
```
Inspects desktop operations. Validates process exit status and confirms execution success conditions.

---

## Internal Components

### 1. `fs.stat` Guard Pattern
In `FilesystemVerifier` (for `delete_file`), verifying that a file was successfully removed requires asserting that querying its statistics throws:
```typescript
try {
  await fs.stat(output['path'])
  failedConditions.push(`File still exists at ${output['path']}`)
} catch {
  checkedConditions.push(`File confirmed deleted at ${output['path']}`)
}
```
This pattern avoids race conditions with file lookups and works consistently across operating systems.

### 2. SHA-256 Checksum Calculation
During file write verification, `FilesystemVerifier` reads the written bytes from disk:
```typescript
const data = await fs.readFile(output['path'])
const checksum = createHash('sha256').update(data).digest('hex')
checkedConditions.push(`File verified at ${output['path']} (SHA-256: ${checksum.slice(0, 8)}...)`)
```
This ensures that the file is not only registered in the filesystem directory table, but is readable and intact on the underlying storage media.

---

## Lifecycle

Verifiers are stateless, lightweight workers created either once per execution runner or instantiated on demand per task:

```
[Adapter Execution Complete]
             |
             v
[Verifier Context Assembled]
             |
             v
[Verifier.verify() Invoked]
             |
             v
[Read Physical State (Disk / DOM / Process)]
             |
             v
[Populate checkedConditions & failedConditions]
             |
             v
[VerificationResult Returned]
             |
             v
[Context Garbage Collected]
```

---

## Error Handling

Verifiers catch unexpected exceptions during their own inspection routine (e.g. disk I/O errors, permission denied while statting files) and translate them into failed conditions:

```typescript
try {
  // Verification logic...
} catch (err: unknown) {
  failedConditions.push(err instanceof Error ? err.message : String(err))
}

return {
  passed: failedConditions.length === 0,
  checkedConditions,
  failedConditions,
  strategy: 'state_check',
  durationMs: Date.now() - start,
}
```

This guarantees that a verification failure never crashes the execution engine with an unhandled rejection. Instead, it produces a clean, structured failure that feeds directly into the self-healing and diagnostics pipeline.

---

## Thread Safety and Concurrency

- **Stateless Execution**: All verifier classes (`BrowserStateVerifier`, `FilesystemVerifier`, `DesktopStateVerifier`) hold zero instance state. All inputs are provided through `VerifierContext`, and all outputs are returned via `VerificationResult`.
- **Concurrent Safe**: Multiple verifiers can run concurrently across parallel task executions without shared mutable state or thread contention.

---

## Performance Characteristics

| Verifier | Action Checked | Typical Duration | Performance Profile |
| :--- | :--- | :--- | :--- |
| `BrowserStateVerifier` | `navigate_website` | < 1 ms | Synchronous string evaluation of URL in adapter output. |
| `BrowserStateVerifier` | `download_file` | 1 - 5 ms | Asynchronous `fs.stat` call on target file path. |
| `FilesystemVerifier` | `write_file` | 2 - 15 ms | `fs.stat` + `fs.readFile` + streaming SHA-256 hash digest. |
| `FilesystemVerifier` | `delete_file` | 1 - 3 ms | `fs.stat` expected rejection. |
| `DesktopStateVerifier` | `execute_command` | < 1 ms | Success condition array expansion. |

---

## Design Tradeoffs

### 1. Decoupled Verification vs. Adapter Self-Reporting
Rather than trusting an adapter's internal report that a task succeeded, verification is delegated to dedicated `ICapabilityVerifier` classes that independently inspect the host OS, live DOM, and storage.
- **Tradeoff**: Completely eliminates false-positive task completions (e.g. an adapter reporting HTTP 200 while landing on a blank page or saving a zero-byte download).
- **Cost**: Introduces a post-execution I/O inspection step (~1ms–15ms per task).

### 2. Structured Condition Arrays vs. Boolean Flags
Instead of returning a simple `boolean`, `VerificationResult` returns arrays of `checkedConditions` and `failedConditions`.
- **Tradeoff**: Provides actionable root-cause diagnostics to the self-healing engine and planner, allowing fine-grained retry decisions.
- **Cost**: Requires verifiers to assemble human-readable condition assertion strings.

---

## Invariants and Guarantees

1. **Independent State Inspection**: Verifiers never re-invoke the adapter that performed the action; they inspect physical state (disk, process table, live DOM) out-of-band.
2. **Non-Zero Byte Guarantee**: For file downloads and file creation, a file is verified if and only if it exists on disk with a byte size greater than zero (`size > 0`).
3. **Verified Deletion Invariant**: Deletion is verified only when querying the target path throws `ENOENT`. If the file is still accessible, verification fails.
4. **Non-Blank Navigation**: A browser navigation task is verified only if the session reports a valid URL differing from `about:blank`.

---

## Failure Modes and Recovery

| Failure Scenario | Detection Mechanism | Verifier Behavior | Upstream System Response |
|---|---|---|---|
| **Zero-Byte Download** | `fs.stat(path).size === 0` | Fails with `'Downloaded file has zero bytes'`. | Triggers download retry or alternative export action. |
| **Silent Navigation Stalling** | URL equals `about:blank` | Fails with `'Browser navigation produced invalid or blank URL'`. | Triggers navigation re-probe via self-healing pipeline. |
| **Locked File Deletion Failure** | `fs.stat(path)` succeeds | Fails with `'File still exists at <path>'`. | Prompts user approval or retries with process unlock. |
| **Empty Text Scraping** | Text length === 0 | Fails with `'No extracted content returned from target selector'`. | Escalates to Vision/OCR extraction stage. |

---

## Things To Avoid

- **Do NOT mark tasks completed based solely on `result.success`.** Adapters can succeed at dispatching an action while the environment fails to transition to the intended state. Always invoke the verifier.
- **Do NOT perform mutating actions inside verifiers.** Verifiers must be strictly read-only inspectors. State mutations belong exclusively in capability adapters.
- **Do NOT ignore `failedConditions`.** When self-healing or retrying, inspect `result.failedConditions` to determine the exact failure reason rather than blindly retrying the same operation.
- **Do NOT introduce unbounded polling loops in verifiers.** Verifiers evaluate instantaneous post-execution state. Timeouts and waiting belong in the adapter's execution phase.

---

## Testing Strategy

Verification tests reside in `packages/execution-core/test/verification.test.ts` and `packages/execution-core/src/__tests__/timeline-replay.test.ts`:

- **Success Condition Validation**: Asserts that when adapter output matches expected postconditions, `passed` is `true` and `failedConditions` is empty.
- **False Positive Rejection**: Simulates an adapter reporting `{ success: true }` but with an empty download path, verifying that `BrowserStateVerifier` correctly flags the failure.
- **Checksum Accuracy**: Tests that `FilesystemVerifier` writes and reads test files, correctly recording SHA-256 hashes in `checkedConditions`.
- **File Deletion Verification**: Verifies that `FilesystemVerifier` fails if a file is still present on disk and passes when the file is truly absent.

---

## Extension Guide

### Creating a Custom Capability Verifier

To add a verifier for a new capability (e.g., database queries or API webhooks):

1. Create a class implementing `ICapabilityVerifier`:
   ```typescript
   import type {
     ICapabilityVerifier,
     VerifierContext,
     VerificationResult,
   } from '@usepilot/execution-core'

   export class DatabaseStateVerifier implements ICapabilityVerifier {
     async verify(ctx: VerifierContext): Promise<VerificationResult> {
       const start = Date.now()
       const checkedConditions: string[] = []
       const failedConditions: string[] = []

       const output = (ctx.result.output ?? {}) as Record<string, unknown>

       if (typeof output['rowCount'] === 'number' && output['rowCount'] > 0) {
         checkedConditions.push(`Database updated: ${output['rowCount']} rows affected`)
       } else {
         failedConditions.push('Database update returned 0 affected rows')
       }

       return {
         passed: failedConditions.length === 0,
         checkedConditions,
         failedConditions,
         strategy: 'state_check',
         durationMs: Date.now() - start,
       }
     }
   }
   ```
2. Register the verifier in the execution runner's capability dispatcher.

---

## Directory Layout

```
packages/execution-core/src/verification/
  `-- capability-verifiers.ts   # Core verifier interfaces and concrete implementations
```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **`CapabilityVerificationResult`** | Verifier Instance | `verify()` routine | Runner, Journal | Step verification cycle | Serialized to execution journal |
| **`ICapabilityVerifier`** | Execution Coordinator | None (Stateless) | Runner | Engine runtime | Instantiated per runner |
| **Verification Journal Events** | `ExecutionJournal` | Verifier runner | Post-mortem reports, UI | Execution run | Database table |

---

## Failure Assumptions

1. **Environmental Query Safety**: Assumes queries performed during verification (`fs.stat`, `page.url()`, `get-clipboard`) are strictly read-only and non-destructive.
2. **False Positive Prevention**: Assumes capability adapters may report exit code 0 or successful Promise resolution while the underlying OS/browser fails to apply changes, making independent state inspection mandatory.
3. **Bounded Assertion Window**: Assumes target environmental state stabilizes within the configured verification duration window (~200ms–2000ms).

---

## Common Extension Points

- **Adding a Custom Capability Verifier**: Implement `ICapabilityVerifier` in `packages/execution-core/src/verification/capability-verifiers.ts` with explicit `checkedConditions` and `failedConditions` arrays.
- **Registering Domain Specific Postconditions**: Extend `TaskSuccessCondition` parsing in verification routines to support semantic assertions (e.g. database record insertion or API response validation).

---

## Examples

### 1. Verifying a Browser File Download
```typescript
import { BrowserStateVerifier } from '@usepilot/execution-core'

const verifier = new BrowserStateVerifier()

const verification = await verifier.verify({
  task: {
    id: 'task-dl',
    title: 'Download sales report',
    requiredCapability: 'download_file',
    successConditions: ['Downloaded file exists on disk'],
  } as any,
  blueprint: {} as any,
  result: {
    success: true,
    output: {
      downloaded: true,
      path: '/downloads/sales-report-2026.pdf',
    },
    durationMs: 1200,
  },
})

console.log('Passed:', verification.passed)
console.log('Checked conditions:', verification.checkedConditions)
// Checked conditions: ['Downloaded file confirmed on disk (204850 bytes)']
```

### 2. Verifying a File Write with Checksum Validation
```typescript
import { FilesystemVerifier } from '@usepilot/execution-core'

const verifier = new FilesystemVerifier()

const verification = await verifier.verify({
  task: {
    id: 'task-write',
    title: 'Write configuration',
    requiredCapability: 'write_file',
    successConditions: ['Configuration file saved'],
  } as any,
  blueprint: {} as any,
  result: {
    success: true,
    output: {
      path: './config/production.json',
      size: 512,
    },
    durationMs: 15,
  },
})

if (!verification.passed) {
  console.error('Verification failed:', verification.failedConditions)
} else {
  console.log('File verified:', verification.checkedConditions)
  // File verified: ['File verified at ./config/production.json (SHA-256: 8f4b1e...)']
}
```

### 3. Detecting a False Positive Execution
```typescript
import { BrowserStateVerifier } from '@usepilot/execution-core'

const verifier = new BrowserStateVerifier()

// Adapter reported success, but navigation landed on blank page
const verification = await verifier.verify({
  task: {
    id: 'task-nav',
    title: 'Navigate to dashboard',
    requiredCapability: 'navigate_website',
    successConditions: ['Page URL is dashboard'],
  } as any,
  blueprint: {} as any,
  result: {
    success: true,
    output: {
      url: 'about:blank',
    },
    durationMs: 300,
  },
})

console.log('Passed:', verification.passed) // false
console.log('Failed:', verification.failedConditions)
// Failed: ['Browser navigation produced invalid or blank URL']
```

---

## Related Documentation

- [Browser Subsystem Documentation](../browser/README.md) - Browser adapter execution and page navigation.
- [Filesystem Adapter Documentation](../filesystem/README.md) - Native file operations and atomic temp writes.
- [Desktop Adapter Subsystem](../desktop/README.md) - Host operating system automation and clipboard operations.
- [Self-Healing Subsystem](../self-healing/README.md) - Remediation pipeline triggered on verification failure.
