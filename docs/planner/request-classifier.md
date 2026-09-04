# RequestClassifier

## Purpose

The `RequestClassifier` is the initial router for all incoming natural language messages. It decouples conversational inquiries from task automation and execution commands.

## Categories

| Category | Description | Example | Target Subsystem |
|---|---|---|---|
| `conversation` | Information seeking, explanations, chatter | "What is Docker and how does it work?" | Chat Stream Engine (Phase 1) |
| `planning` | Action-oriented tasks requiring multi-step computer interaction | "Download all invoices from Amazon Business" | Planner Service (Phase 2) |
| `execution` | Lifecycle commands for previously planned blueprints | "Execute blueprint #3" / "Cancel execution" | Execution Engine (Phase 3) |
| `unknown` | Ambiguous input with low confidence | "Maybe later" | Chat Stream Engine |

## Two-Pass Routing Architecture

1. **Heuristic Pass**: Evaluates high-signal keywords (e.g. `download`, `organize`, `execute plan`). If confidence exceeds `0.75`, classification returns synchronously in under 1ms without invoking an LLM.
2. **LLM Fallback**: Ambiguous messages are sent to the active provider with a JSON classification prompt with temperature 0.0.
