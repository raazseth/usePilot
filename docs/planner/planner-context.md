# PlannerContext

## Purpose

The planner does not generate plans in a vacuum. The `PlannerContextBuilder` aggregates active host environment details, discovered applications, permissions, user preferences, and recent execution history to ground planning in reality.

## Schema Contract

```typescript
export interface PlannerContext {
  conversationId: string
  conversationHistory: ConversationHistoryEntry[]
  settings: PlannerSettingsContext
  availableTools: TaskTool[]
  availableCapabilities?: TaskCapability[] | undefined
  installedApplications?: string[] | undefined
  availableBrowsers?: string[] | undefined
  filesystemPermissions?: string[] | undefined
  providerCapabilities?: string[] | undefined
  platform: 'windows' | 'macos' | 'linux'
  previousBlueprints: BlueprintSummary[]
  userPreferences?: Record<string, unknown> | undefined
}
```

## Context Injections

- **Available Capabilities & Tools**: Informs the planner which capabilities the local host can execute, preventing generation of unattainable tasks.
- **Discovered Applications & Browsers**: Identifies installed desktop apps and web browsers (e.g. `chrome`, `edge`, `firefox`) to guide task generation.
- **Filesystem Permissions**: Declares allowed filesystem boundaries (e.g. `read_downloads`, `write_documents`).
- **Platform**: Ensures file path delimiters (`\` vs `/`) and shell semantics match the host OS.
- **Previous Blueprints**: Injects summaries of the most recent blueprints to maintain consistency with past user preferences.

