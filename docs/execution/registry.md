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

In Phase 3, `createDefaultRegistry()` populates all 17 capabilities with `StubAdapter` (priority 0) to validate runtime plumbing before concrete adapters are introduced in Phase 4.
