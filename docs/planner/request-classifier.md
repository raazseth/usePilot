# RequestClassifier

## Purpose

The `RequestClassifier` is the initial router for all incoming natural language messages. It decouples conversational inquiries from task automation and execution commands.

## Categories

```typescript
export type RequestType = 'conversation' | 'planning' | 'execution' | 'unknown'
```

| Category | Description | Example | Target Subsystem |
|---|---|---|---|
| `conversation` | Information seeking, explanations, chatter | "What is Docker and how does it work?" | Chat Stream Handler |
| `planning` | Action-oriented tasks requiring multi-step automation | "Download all invoices from Amazon Business" | Planner Service |
| `execution` | Lifecycle commands for previously generated blueprints | "Execute blueprint #3" / "Cancel execution" | Execution Runner |
| `unknown` | Ambiguous input with low confidence | "Maybe later" | Chat Stream Handler (Clarification) |

## Output Contract

```typescript
export interface ClassificationResult {
  type: RequestType
  confidence: number
  reason: string
  signals: string[]
  durationMs: number
}
```

## Two-Pass Routing Architecture

1. **Heuristic Pass**: Evaluates high-signal regex patterns and verbs (e.g. `download`, `organize`, `run plan`). If confidence exceeds `0.75`, classification returns synchronously in under 1ms without invoking an external provider.
2. **Provider Fallback**: Ambiguous messages are classified by the active model provider using a structured JSON schema at temperature 0.0.

