# Capability Adapters

Every execution action in usePilot flows through an adapter implementing `ICapabilityAdapter`.

## Interface Contract

```typescript
export interface ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority: number
  readonly platformSupport: Array<'windows' | 'macos' | 'linux'>
  readonly name: string

  initialize(): Promise<void>
  execute(ctx: AdapterContext): Promise<AdapterResult>
  verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult>
  cleanup(): Promise<void>
  dispose(): Promise<void>
  isAvailable(): Promise<boolean>
}
```

## Lifecycle Protocol

1. **`initialize()`**: Set up runtime resources (e.g. browser context, file handle).
2. **`execute(ctx)`**: Perform task work. Must respect `ctx.signal` for cooperative cancellation.
3. **`verify(ctx, result)`**: Adapter-specific verification hooks.
4. **`cleanup()`**: Clean temporary workspace/artifacts.
5. **`dispose()`**: Terminate background worker or native process.

## Stub Adapters

The runtime provides stub adapters for all 17 capabilities. Each stub simulates successful execution with realistic latency, exercising all state transitions, verification hooks, checkpoints, and journals without external side effects.
