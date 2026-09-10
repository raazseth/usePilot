# Native Desktop Adapter

Desktop Adapter (`@usepilot/execution-core/src/adapters/desktop`) provides cross-platform desktop automation across Windows, macOS, and Linux, handling clipboard synchronization with race-condition caching, detached background application execution, shell command orchestration, and postcondition verification.

---

## Purpose

Automated desktop agents must bridge browser and web tasks with host operating system capabilities: transferring text across applications via the system clipboard, invoking developer tools and shell scripts, and launching external desktop applications. Direct operating system interaction is fraught with platform inconsistencies, command escaping vulnerabilities, hanging standard input streams, and clipboard race conditions where one process overwrites another before the paste completes.

The Native Desktop Adapter owns:
- Cross-platform system clipboard reads (`powershell Get-Clipboard`, `pbpaste`, `xclip`).
- Cross-platform system clipboard writes (`clip`, `pbcopy`, `xclip`).
- Short-term in-memory clipboard caching to eliminate clipboard contention and timing races.
- Shell command execution with standard output/error capture and execution timeouts.
- Detached, non-blocking native application launching.
- Cancellation handling through Node.js `AbortSignal`.
- Independent post-write clipboard verification.

The Native Desktop Adapter intentionally does NOT own:
- Graphical user interface event emulation (mouse coordinate clicks, keyboard scancode injection).
- Window hierarchy inspection or accessibility tree navigation (handled via platform-specific sidecars).
- File manipulation or path containment (delegated to the Filesystem Adapter).
- Security policy evaluation or command sandboxing (delegated to the Security subsystem).

---

## Design Principles

### 1. Dual-Layer Clipboard Architecture
Operating system clipboards are shared global singletons. In high-speed automated environments, invoking OS clipboard binaries (`clip.exe` or `xclip`) incurs process creation latency (~50-100ms) and can fail if another application locks the clipboard. The adapter employs a dual-layer strategy:
1. **In-Memory Cache**: All writes immediately update a static memory cache (`memoryClipboard`) with a timestamp.
2. **Native OS Bridge**: The adapter asynchronously pipes text into the native platform utility (`clip`, `pbcopy`, or `xclip`).
3. **Cache-First Short-Circuit**: Reads occurring within 10,000 milliseconds of an internal write resolve immediately from memory, avoiding redundant process spawns and guarding against OS clipboard latency.

### 2. Guarded Process Piping for Clipboard Writes
Writing to the Windows `clip.exe` utility can deadlock if the standard input pipe remains open or if `clip.exe` hangs waiting for terminal allocation. The adapter wraps `spawn('clip')` with:
- Synchronous standard input stream ending (`proc.stdin.end()`).
- Explicit standard I/O redirection (`stdio: ['pipe', 'ignore', 'ignore']`).
- A 1,500ms safety timeout that terminates the child process if it fails to exit promptly.

### 3. Detached Application Spawning
When launching a desktop application (such as an editor, viewer, or calculator), the agent process must not block waiting for the application to close. The adapter spawns applications using `detached: true`, ignores standard I/O streams, and explicitly unreferences the child process (`child.unref()`). This ensures the agent runtime can proceed or exit cleanly without retaining the target application as a child process.

### 4. Direct Abort Propagation
Shell command executions are bound directly to the task context `AbortSignal`. If the user cancels an execution or an upstream timeout expires, the underlying OS process tree receives an immediate termination signal.

---

## Where It Fits

The Native Desktop Adapter implements the `ICapabilityAdapter` interface from `@usepilot/execution-types` and is registered with the capability execution router in `packages/execution-core`.

```
                  +-----------------------------------+
                  |        Execution Engine           |
                  +-----------------------------------+
                                    |
                                    | Dispatches task
                                    v
                  +-----------------------------------+
                  |      NativeDesktopAdapter         |
                  +-----------------------------------+
                     /            |                \
                    /             |                 \
     read_clipboard/   write_     | execute_command  \ launch app
                  /    clipboard  |                   \
                 v                v                    v
         +-------------+  +-----------------+  +-----------------+
         | Get-Clipboard  | clip / pbcopy / |  | spawn(appName)  |
         | pbpaste     |  | xclip (piped)   |  | detached: true  |
         | xclip -o    |  | + mem cache     |  | child.unref()   |
         +-------------+  +-----------------+  +-----------------+
                 |                |                    |
                 +----------------+--------------------+
                                  |
                                  v
                  +-----------------------------------+
                  |     Operating System Host         |
                  |     (Windows / macOS / Linux)     |
                  +-----------------------------------+
                                  ^
                                  | Validates state
                  +-----------------------------------+
                  |       DesktopStateVerifier        |
                  +-----------------------------------+
```

### Callers and Collaborators
- **Execution Runner**: Dispatches tasks requesting `read_clipboard`, `write_clipboard`, or `execute_command`.
- **DesktopStateVerifier**: Inspects the operating system clipboard post-execution to confirm text content was written accurately.
- **Planner**: Generates plans invoking desktop commands when web-based automation reaches boundary transitions (such as downloading a file and opening it in an external viewer).

---

## Architecture

```
packages/execution-core/src/adapters/desktop/
  `-- desktop-adapter.ts       # NativeDesktopAdapter implementation
packages/execution-core/src/verification/
  `-- capability-verifiers.ts  # DesktopStateVerifier implementation
```

### Component Roles

| Component | Responsibility |
| :--- | :--- |
| `NativeDesktopAdapter` | Implements `ICapabilityAdapter`. Executes platform-specific clipboard commands, spawns detached processes, runs shell commands, and handles timeouts. |
| `DesktopAdapterOptions` | Configuration interface providing custom shell overrides. |
| `DesktopStateVerifier` | Validates post-execution state, verifying clipboard content matches expected text. |

---

## Core Concepts

### 1. Platform-Specific Command Matrix

The adapter detects the host platform via Node.js `process.platform` and dispatches native utilities:

| Capability | Windows (`win32`) | macOS (`darwin`) | Linux (`linux`) |
| :--- | :--- | :--- | :--- |
| **Read Clipboard** | `powershell -NoProfile -Command "Get-Clipboard"` | `pbpaste` | `xclip -selection clipboard -o` |
| **Write Clipboard** | `spawn('clip')` + piped stdin + 1.5s timeout | `spawn('pbcopy')` + piped stdin | `spawn('xclip', ['-selection', 'clipboard'])` + piped stdin |
| **Run Command** | `execAsync(command, { timeout: 60000, signal })` | `execAsync(command, { timeout: 60000, signal })` | `execAsync(command, { timeout: 60000, signal })` |
| **Launch App** | `spawn(appName, [], { detached: true, shell: true })` | `spawn(appName, [], { detached: true, shell: true })` | `spawn(appName, [], { detached: true, shell: true })` |

### 2. The 10-Second Memory Cache Window
When text is written to the clipboard, the operating system can take multiple scheduling ticks to expose the data to external process queries. Additionally, repeated shell process launches to read clipboard data introduce unnecessary CPU overhead. The adapter stores the written text in a static class variable:
```typescript
private static memoryClipboard = ''
private static lastWrittenTimestamp = 0
```
When `readSystemClipboard()` is called within 10,000 milliseconds of a local write, the in-memory string is returned immediately. If the time window has elapsed, the native platform utility is queried, falling back to the memory string if the operating system call fails.

### 3. Detached Application Process Isolation
When launching external applications via task descriptions containing `"launch"` or `"open"`, the child process must outlive the ephemeral adapter instance:
```typescript
const child = spawn(appName, [], { detached: true, stdio: 'ignore', shell: true })
child.unref()
```
`child.unref()` excludes the child from the event loop's reference count, allowing the Node.js agent runtime to terminate naturally even while the launched application remains open on the user desktop.

---

## Data Flow

```
1. Task Dispatch
   runner.dispatch(task) -> adapter.execute(ctx)
      |
      v
2. Abort Check
   if (ctx.signal.aborted) -> Return failureCategory: 'cancellation'
      |
      v
3. Capability Routing
   switch (this.capability):
      |
      +---> 'read_clipboard'
      |     - If memoryCache valid (<10s) -> return memoryCache
      |     - Else execute platform command (Get-Clipboard / pbpaste / xclip)
      |     - Return { content, length }
      |
      +---> 'write_clipboard'
      |     - Update memoryCache and timestamp
      |     - Spawn platform tool (clip / pbcopy / xclip)
      |     - Pipe text -> end stdin -> await close (or 1.5s timeout)
      |     - Return { written: true, length }
      |
      +---> 'execute_command'
      |     - child_process.exec(command, { timeout: 60000, signal })
      |     - Return { stdout, stderr, exitCode: 0 }
      |
      +---> default (launch / open)
            - spawn(appName, { detached: true, stdio: 'ignore', shell: true })
            - child.unref()
            - Return { application, launched: true, pid }
      |
      v
4. Verification
   adapter.verify(ctx, result)
   - If write_clipboard: readBack = readSystemClipboard() -> confirm text matches
   - Return VerificationResult { passed: true, checkedConditions }
```

---

## Public API

### `NativeDesktopAdapter`

Located in `packages/execution-core/src/adapters/desktop/desktop-adapter.ts`.

#### Constructor
```typescript
constructor(
  capability: TaskCapability,
  _options?: DesktopAdapterOptions | undefined
)
```

- `capability`: The capability handled by this instance (`'read_clipboard'`, `'write_clipboard'`, `'execute_command'`).
- `_options.shell`: Optional custom shell path override.

#### Properties
- `readonly capability: TaskCapability`: Registered capability name.
- `readonly priority: number = 100`: Default priority level.
- `readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']`: Cross-platform support.
- `readonly name: string = 'NativeDesktopAdapter'`: Adapter name identifier.

#### Lifecycle Methods
```typescript
initialize(): Promise<void>
isAvailable(): Promise<boolean>
cleanup(): Promise<void>
dispose(): Promise<void>
```
Standard lifecycle hooks satisfying `ICapabilityAdapter`.

#### Execution & Verification
```typescript
// Execute desktop operation
execute(ctx: AdapterContext): Promise<AdapterResult>

// Verify clipboard or desktop postconditions
verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
```

---

### Output Contracts

#### `read_clipboard` Output
```typescript
interface ReadClipboardOutput {
  content: string   // Text content currently on system clipboard
  length: number    // Character length of the content
}
```

#### `write_clipboard` Output
```typescript
interface WriteClipboardOutput {
  written: true
  length: number    // Character length of text written
}
```

#### `execute_command` Output
```typescript
interface ExecuteCommandOutput {
  stdout: string    // Trimmed standard output stream
  stderr: string    // Trimmed standard error stream
  exitCode: number  // Process exit code (0 on success)
}
```

#### Application Launch Output
```typescript
interface LaunchAppOutput {
  application: string  // Target executable or command name
  launched: true
  pid?: number         // Process ID of the spawned background application
}
```

---

## Internal Components

### 1. `readSystemClipboard(): Promise<string>`
Evaluates the host operating system platform and executes the appropriate reader binary with a 3,000 millisecond timeout:
- Windows: `powershell -NoProfile -Command "Get-Clipboard"`
- macOS: `pbpaste`
- Linux: `xclip -selection clipboard -o`

If the subprocess throws or times out, it falls back silently to `NativeDesktopAdapter.memoryClipboard`.

### 2. `writeSystemClipboard(text: string): Promise<void>`
Updates `memoryClipboard` and `lastWrittenTimestamp`. Then routes to platform binaries:
- Windows: Uses `spawn('clip')`. Attaches event handlers to both `'error'` and `'close'` to clear the 1,500ms fallback safety timer.
- macOS: Uses `spawn('pbcopy')`.
- Linux: Uses `spawn('xclip', ['-selection', 'clipboard'])`.

### 3. `DesktopStateVerifier`
Located in `packages/execution-core/src/verification/capability-verifiers.ts`. Inspects execution results and verifies that desktop tasks satisfied their postconditions.

---

## Lifecycle

```
   +------------------------------------+
   | Instantiation                      |
   | new NativeDesktopAdapter(cap)      |
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
   | - Performs OS operation            |
   | - Captures output streams / PID    |
   +------------------------------------+
                     |
                     v
   +------------------------------------+
   | Verification                       |
   | await adapter.verify(ctx, result)  |
   | - Reads back clipboard state       |
   | - Asserts output presence          |
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
Before invoking any child process, the adapter checks `ctx.signal.aborted`. In `execute_command`, `ctx.signal` is passed directly into `execAsync`:
```typescript
const { stdout, stderr } = await execAsync(command, {
  signal: ctx.signal,
  timeout: 60000,
})
```
If the signal fires while the command is running, the operating system kills the child process and the adapter returns:
```typescript
{
  success: false,
  error: errorMsg,
  failureCategory: ctx.signal.aborted ? 'cancellation' : 'adapter_failure',
  durationMs: Date.now() - start,
}
```

### 2. Windows Clipboard Timeout Guard
Windows `clip.exe` can hang indefinitely under certain edge cases (e.g. running under non-interactive service accounts without standard input pipes). The adapter sets a 1,500ms safety timer that terminates `clip.exe` via `proc.kill()` and resolves cleanly, relying on the synchronous in-memory cache update.

### 3. Graceful Fallback on Missing Native Utilities
If a Linux environment lacks `xclip` or a Windows server has PowerShell restricted, the system clipboard write still succeeds in-process through `memoryClipboard`. Downstream tasks within the same execution session can read the written text seamlessly.

---

## Design Tradeoffs

### 1. Dual-Layer Memory + OS Clipboard vs. Pure OS Invocation
Direct operating system clipboard access via CLI tools (`powershell`, `pbpaste`, `xclip`) incurs 50ms–300ms subprocess spawning overhead and is susceptible to transient OS clipboard locks by other applications.
- **Tradeoff**: Maintains a static in-memory cache (`memoryClipboard`) with a 10-second TTL that satisfies immediate read-back queries in sub-millisecond time.
- **Cost**: If an external human user modifies the OS clipboard within 10 seconds of an automated write, the memory cache will return the agent's prior text until the window expires.

### 2. Detached Unreferenced Spawning vs. Monitored Child Processes
When launching desktop applications (`notepad.exe`, calculator, terminal windows), the adapter marks child processes with `detached: true` and calls `child.unref()`.
- **Tradeoff**: Allows the Node.js agent runtime to exit cleanly without keeping launched applications hostage or killing user applications when the automation concludes.
- **Cost**: The agent cannot monitor the exit code or lifespan of the launched application once spawned.

---

## Invariants and Guarantees

1. **10-Second Memory Window**: Any `read_clipboard` call executed within 10,000ms of a `write_clipboard` operation returns from memory immediately without invoking the operating system shell.
2. **Process Independence**: Desktop applications launched with `detached: true` do not hold references in the Node.js event loop. The agent process will never hang waiting for a user to close an opened application.
3. **Execution Timeout Boundary**: `execute_command` enforces a hard 60,000ms timeout ceiling bound to `ctx.signal`. Runaway shell commands are killed at the OS kernel level upon timeout.
4. **Guarded Stdin Termination**: Windows `clip.exe` writes enforce a 1,500ms safety timer that terminates the child process if it fails to exit promptly after closing standard input.

---

## Failure Modes and Recovery

| Failure Mode | Detection | Automated Recovery | Non-Goals (What It Won't Do) |
|---|---|---|---|
| **Hanging `clip.exe`** | 1,500ms timer expires | `proc.kill()` terminates the process; memory clipboard satisfies subsequent queries. | Does not retry native clip spawn if the system pipe is broken. |
| **Missing CLI Utility** | `xclip` not found (Linux) | Caught in try/catch; falls back to internal `memoryClipboard`. | Does not install OS packages (apt/brew) automatically. |
| **Command Timeout** | 60,000ms limit or AbortSignal | Child process killed via signal; returns `failureCategory: 'cancellation'`. | Does not save partial unbuffered stdout from killed processes. |
| **Non-Zero Exit Code** | `execAsync` error reject | Returns `success: false` with stderr in output payload. | Does not guess command syntax corrections. |

---

## Things To Avoid

- **Do NOT execute long-running background servers via `execute_command`.** `execute_command` buffers stdout/stderr in memory and enforces a 60s timeout ceiling. Use detached application spawning for persistent processes.
- **Do NOT assume system clipboard changes are instant across applications.** The operating system message pump may delay clipboard availability to other processes. Rely on the adapter's verification checks before proceeding.
- **Do NOT concatenate unsanitized user strings directly into shell commands.** Command injection vulnerabilities can compromise the user desktop. Sanitize or escape parameters before executing shell strings.
- **Do NOT expect memory clipboard to survive process restart.** `memoryClipboard` is static in-process memory. If the Node.js backend restarts, clipboard state reverts to native OS reader queries.

---

## Thread Safety and Concurrency

- **Static Clipboard State**: `memoryClipboard` is maintained as a static variable on `NativeDesktopAdapter`. All instances of the adapter across different task executions share this cache.
- **Process Isolation**: Command execution via `execAsync` runs in an independent child process with private stdout/stderr buffers.
- **Child Process Unreferencing**: Launched desktop applications run in separate process groups (`detached: true`) and do not hold locks on the runtime process.

---

## Performance Characteristics

| Operation | Mechanism | Latency / Overhead |
| :--- | :--- | :--- |
| `read_clipboard` (cache hit) | In-memory string return | < 1 ms |
| `read_clipboard` (cache miss, Windows) | `powershell -NoProfile Get-Clipboard` | 150 - 300 ms (PowerShell startup) |
| `read_clipboard` (cache miss, macOS) | `pbpaste` binary | 5 - 15 ms |
| `read_clipboard` (cache miss, Linux) | `xclip` binary | 5 - 20 ms |
| `write_clipboard` | `memoryClipboard` + piped spawn | Synchronous memory update (<1ms) + async background pipe (~20-50ms) |
| `execute_command` | `child_process.exec` | Bound by command runtime (60s timeout ceiling) |
| `launch application` | `spawn` with `detached: true` + `unref` | 10 - 30 ms (non-blocking) |

---

## Testing Strategy

Desktop adapter tests are located in `packages/execution-core/test/desktop-adapter.test.ts`:

- **Clipboard Round-Trip**: Writes a known string to the clipboard, reads it back, and validates exact string equality.
- **Memory Cache Invalidation**: Confirms that writes return immediately from cache and that subsequent reads retrieve the written payload without spawning processes.
- **Command Execution & Timeout**: Executes standard shell commands (`echo`, `dir`, `ls`), capturing stdout and stderr. Confirms that hanging commands terminate at the 60-second limit or when an `AbortSignal` is triggered.
- **Verification Logic**: Asserts that `verify()` accurately detects clipboard text mismatches and passes when text matches.

---

## Extension Guide

### Adding Support for Keystroke / Shortcut Automation

1. Create a platform driver module under `packages/execution-core/src/adapters/desktop/drivers/`.
2. Add the capability name to `TaskCapability` in `packages/planner-types`.
3. In `NativeDesktopAdapter.execute()`, add a handler:
   ```typescript
   case 'send_keys': {
     const keys = params['keys'] as string
     await this.sendNativeKeystrokes(keys)
     output = { sent: true, keys }
     break
   }
   ```
4. Implement platform-specific keystroke dispatch (e.g. `SendKeys` via PowerShell on Windows, AppleScript via `osascript` on macOS, `xdotool` on Linux).

---

## Directory Layout

```
packages/execution-core/src/adapters/desktop/
  `-- desktop-adapter.ts       # NativeDesktopAdapter, options, and clipboard management
packages/execution-core/src/verification/
  `-- capability-verifiers.ts  # DesktopStateVerifier implementation
```

---

## Data Ownership and Lifecycle

| Structure | Owner | Mutators | Readers | Lifetime | Persistence |
|---|---|---|---|---|---|
| **OS Clipboard** | Host Operating System | Native Desktop Adapter, User | All host applications | Until overwritten by OS | Host memory |
| **In-Memory Clipboard Cache** | `NativeDesktopAdapter` | `writeClipboard()` | `readClipboard()` (<10s) | Process lifetime or 10s TTL | In-memory only |
| **Spawned Child Processes** | Host OS Process Table | `spawnCommand()` / `launchApp()` | OS scheduler | Until process exits | Ephemeral |
| **Command Output Buffers** | `NativeDesktopAdapter` | Child process stdout/stderr | Caller / Verifier | Task execution duration | Discarded after result return |

---

## Failure Assumptions

1. **Host Utility Availability**: Assumes platform clipboard utilities (`powershell`/`clip` on Windows, `pbcopy`/`pbpaste` on macOS, `xclip` on Linux) exist in system `PATH`. If missing, the adapter falls back cleanly to internal memory clipboard caching.
2. **Process Non-Interference**: Assumes spawned background processes run independently and do not block Node's event loop (`unref()` detach semantics).
3. **Execution Timeouts**: Assumes shell commands may hang or await interactive stdin, enforcing default 30-second abort timeouts.

---

## Common Extension Points

- **Adding a Platform Clipboard Backend**: Extend the platform switch in `getClipboardCommand()` and `writeClipboardCommand()` in `desktop-adapter.ts` (e.g. adding Wayland `wl-copy`/`wl-paste` support).
- **Custom Desktop Capability Handlers**: Implement new capability verbs (e.g. `send_notification`, `minimize_window`) in `NativeDesktopAdapter.execute()` and register verification checks in `DesktopStateVerifier`.

---

## Examples

### 1. Writing Text to the System Clipboard
```typescript
import { NativeDesktopAdapter } from '@usepilot/execution-core'

const adapter = new NativeDesktopAdapter('write_clipboard')

const result = await adapter.execute({
  task: {
    id: 'task-clip-1',
    title: 'Copy authentication token',
    requiredCapability: 'write_clipboard',
    toolConfig: {
      text: 'token_abc123xyz789',
    },
    successConditions: ['Clipboard confirmed contains written text'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
})

console.log(result.success) // true
console.log(result.output)  // { written: true, length: 21 }
```

### 2. Reading Text from the System Clipboard
```typescript
import { NativeDesktopAdapter } from '@usepilot/execution-core'

const adapter = new NativeDesktopAdapter('read_clipboard')

const result = await adapter.execute({
  task: {
    id: 'task-clip-2',
    title: 'Read copied value',
    requiredCapability: 'read_clipboard',
    successConditions: ['Clipboard read successfully'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
})

if (result.success) {
  const { content } = result.output as { content: string }
  console.log('Clipboard contents:', content)
}
```

### 3. Executing a Native Shell Command
```typescript
import { NativeDesktopAdapter } from '@usepilot/execution-core'

const adapter = new NativeDesktopAdapter('execute_command')

const controller = new AbortController()

const result = await adapter.execute({
  task: {
    id: 'task-cmd-1',
    title: 'Check Git status',
    requiredCapability: 'execute_command',
    toolConfig: {
      command: 'git status --porcelain',
    },
    successConditions: ['Command exits with code 0'],
  },
  signal: controller.signal,
  blueprint: {} as any,
})

if (result.success) {
  const { stdout } = result.output as { stdout: string }
  console.log('Git Status:\n', stdout)
}
```

### 4. Launching an External Desktop Application
```typescript
import { NativeDesktopAdapter } from '@usepilot/execution-core'

const adapter = new NativeDesktopAdapter('execute_command')

const result = await adapter.execute({
  task: {
    id: 'task-launch-1',
    title: 'Open Notepad',
    requiredCapability: 'execute_command',
    toolConfig: {
      app: 'notepad.exe',
    },
    successConditions: ['Application launched'],
  },
  signal: new AbortController().signal,
  blueprint: {} as any,
})

console.log(result.output)
// { application: 'notepad.exe', launched: true, pid: 14820 }
```

---

## Related Documentation

- [Capability Verification Documentation](../verification/README.md) - Independent verification of clipboard and process state.
- [Filesystem Adapter Documentation](../filesystem/README.md) - File and directory manipulation on the host operating system.
- [Browser Subsystem Documentation](../browser/README.md) - Web browser automation and multi-tab coordination.
