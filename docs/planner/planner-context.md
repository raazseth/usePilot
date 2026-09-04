# PlannerContext

## Purpose

The planner does not generate plans in a vacuum. The `PlannerContextBuilder` aggregates active workstation details, user preferences, and history to ground the AI reasoning.

## Schema

```typescript
export interface PlannerContext {
  conversationId: string
  conversationHistory: ConversationHistoryEntry[]
  settings: PlannerSettingsContext
  availableTools: TaskTool[]
  platform: 'windows' | 'macos' | 'linux'
  previousBlueprints: BlueprintSummary[]
  userPreferences?: Record<string, unknown>
}
```

## Context Injections

- **Available Tools**: Prevents the planner from proposing tools not installed or supported.
- **Platform**: Ensures OS path delimiters (e.g. `C:\...` vs `/...`) and shell syntax match the user's OS.
- **Previous Blueprints**: Injects the last 3-5 completed blueprints so the model understands prior user naming conventions and past preferences.
