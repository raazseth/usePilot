# Capability Adapters

Every execution action in usePilot flows through an adapter implementing `ICapabilityAdapter`. Adapters isolate domain logic (browser interaction, file operations, shell execution, window management, vision processing) behind a uniform interface.

## Interface Contract

```typescript
export interface ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority: number
  readonly platformSupport: ('windows' | 'macos' | 'linux')[]
  readonly name: string
  readonly adapterVersion?: string | undefined
  readonly minimumRuntimeVersion?: string | undefined
  readonly featureFlags?: string[] | undefined
  readonly manifest?: Readonly<AdapterManifest> | undefined

  initialize(): Promise<void>
  execute(ctx: AdapterContext): Promise<AdapterResult>
  verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
  cleanup(): Promise<void>
  dispose(): Promise<void>
  isAvailable(): Promise<boolean>
  diagnose?(): Promise<AdapterStartupDiagnostic>
}
```

## Adapter Manifest

Adapters may declare an immutable `AdapterManifest` defining structural constraints:

```typescript
export interface AdapterManifest {
  readonly name: string
  readonly version: string
  readonly apiVersion: string
  readonly runtimeVersion: string
  readonly platform: readonly ('windows' | 'macos' | 'linux')[]
  readonly permissions: readonly string[]
  readonly capabilities: readonly TaskCapability[]
  readonly featureFlags: readonly string[]
  readonly hash: string
}
```

## Diagnostics

Before or during execution, adapters can report their operational readiness via `diagnose()`:

```typescript
export interface AdapterStartupDiagnostic {
  success: boolean
  adapterName: string
  reason?: 'success' | 'platform_mismatch' | 'missing_executable' | 'permission_denied' | 'dependency_missing' | 'initialization_error' | undefined
  error?: string | undefined
  missingDependency?: string | undefined
  missingPermission?: string | undefined
  durationMs: number
}
```

## Lifecycle Protocol

1. **`initialize()`**: Set up runtime resources (e.g. launch browser process, acquire file lock, verify dependencies).
2. **`execute(ctx)`**: Perform task work. Must observe `ctx.signal` for cooperative cancellation.
3. **`verify(ctx, result)`**: Adapter-level verification hooks testing whether the action achieved its intended outcome.
4. **`cleanup()`**: Reset ephemeral task state without destroying long-lived daemon connections.
5. **`dispose()`**: Terminate subprocesses, close active sessions, and release OS resources.
6. **`isAvailable()`**: Probe environment (OS, installed binaries, system permissions) to ensure adapter viability before task dispatch.

## Native Implementations

usePilot implements native runtime adapters alongside stub implementations:
- **`PlaywrightBrowserAdapter`**: Headed and headless browser automation with deterministic action waiting and DOM inspection.
- **`NativeFilesystemAdapter`**: Safe atomic read, write, move, and directory traversal operations with sandbox path restrictions.
- **`NativeDesktopAdapter`**: Platform clipboard, window management, and application interaction.
- **`VisionRuntime`**: Screenshot capture and visual region verification via `ScreenAnalyzer`.
- **`StubAdapter`**: Deterministic simulated execution across all 17 capabilities for unit testing, test suites, and simulation runs.


