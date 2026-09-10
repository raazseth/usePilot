# Capability Registry

The `CapabilityRegistry` decouples planning goals from execution implementations.

## Dynamic Resolution

Tasks specify a required `TaskCapability` (e.g., `navigate_website`, `download_file`, `read_file`, `execute_command`). The registry dynamically matches candidates through:
1. `capability`: Target capability match.
2. `platform`: Host OS support (`windows`, `macos`, `linux`). If `platformSupport` is empty, the adapter supports all platforms.
3. `priority`: Highest priority adapter is selected if multiple candidates qualify.
4. `diagnose()`: Diagnostic probes verifying dependencies and permissions before selection.

## Registration Contract

```typescript
export type AdapterFactory = (config?: Record<string, unknown>) => ICapabilityAdapter

export interface AdapterRegistration {
  factory: AdapterFactory
  capability: TaskCapability
  priority: number
  platformSupport: ('windows' | 'macos' | 'linux')[]
  name: string
}
```

## Registration API

```typescript
registry.register({
  capability: 'navigate_website',
  priority: 10,
  platformSupport: ['windows', 'macos', 'linux'],
  name: 'PlaywrightBrowserAdapter',
  factory: (config) => new PlaywrightBrowserAdapter(config),
})
```

By default, `createDefaultRegistry()` registers production adapters for browser automation, filesystem operations, desktop interaction, and vision verification, alongside stub fallbacks for simulation and offline execution.

