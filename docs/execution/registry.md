# Capability Registry

The `CapabilityRegistry` decouples planning goals from execution implementations.

## Dynamic Resolution

Tasks specify a required `TaskCapability` (e.g., `navigate_website`, `download_file`, `read_file`). The registry dynamically matches:
1. `capability`: Target capability match.
2. `platform`: Host OS support (`windows`, `macos`, `linux`). If `platformSupport` is empty, the adapter supports all platforms.
3. `priority`: Highest priority adapter is selected if multiple match.

## Registration API

```typescript
registry.register({
  capability: 'navigate_website',
  priority: 10,
  platformSupport: ['windows', 'macos', 'linux'],
  name: 'PlaywrightAdapter',
  factory: (config) => new PlaywrightAdapter(config),
})
```

By default, `createDefaultRegistry()` registers baseline adapters for all 17 capabilities, allowing concrete implementations to override them based on platform and priority.
