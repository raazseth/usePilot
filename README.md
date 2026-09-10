# usePilot

> A privacy-first desktop AI assistant that understands natural language, plans deterministic workflows, and safely operates your computer - entirely on your own machine.

---

## Why usePilot?

Most AI assistants stop after generating text.

usePilot is built to **understand an objective, create a plan, execute it, verify the result, recover from failures, and explain what happened** - while keeping your data on your computer.

The project is designed around one principle:

> AI should help you operate your computer, not own your data.

Everything is built around deterministic execution, strong architectural boundaries, and privacy-first defaults.

---

## Core Principles

### Local First

Your files, conversations, browser state, runtime context, and execution history remain on your machine.

No cloud dependency is required.

---

### Privacy by Default

No telemetry.

No analytics.

No hidden tracking.

No background data collection.

You decide which AI model is used.

---

### Deterministic Execution

LLMs are responsible for reasoning.

They are **never responsible for execution**.

Every execution passes through a deterministic runtime with verification, recovery, and approval layers.

---

### Provider Agnostic

Works with:

- Ollama
- LM Studio
- OpenAI-compatible APIs

The application never depends on a single AI vendor.

---

### Extensible

Every subsystem is isolated behind stable interfaces.

Capabilities can be added without modifying existing execution logic.

---

# What usePilot Can Do

Current architecture supports:

- Natural language task planning
- Multi-step execution
- Browser automation
- Desktop automation
- Filesystem operations
- Runtime verification
- Human approvals
- Runtime context management
- Knowledge caching
- Observation engine
- Runtime search
- Execution replay
- Failure recovery
- Execution history
- Browser knowledge graph
- Runtime entity graph
- Context snapshots
- Immutable execution timeline

---

# High-Level Architecture

```
                User

                  │

                  ▼

            Planner Engine

                  │

                  ▼

      Runtime Context Facade

   ┌────────────────────────────┐
   │ Query                      │
   │ Runtime State              │
   │ Observations               │
   │ Knowledge                  │
   │ Entity Graph               │
   │ Browser Graph              │
   │ Runtime Search             │
   │ Replay                     │
   └────────────────────────────┘

                  │

                  ▼

        Deterministic Execution

                  │

                  ▼

         Capability Adapters

      Browser • Desktop • Files
```

Execution never bypasses the runtime.

The planner never directly controls adapters.

Every subsystem communicates through well-defined boundaries.

---

# Runtime Context

The Runtime Context Layer acts as the operating memory of usePilot.

It continuously maintains:

- Current browser state
- Desktop state
- Filesystem state
- Runtime observations
- Knowledge cache
- Runtime index
- Browser graph
- Entity graph
- Execution memory
- Context snapshots
- Replay history

Everything is exposed through a single public interface:

```
RuntimeContextFacade
```

Internal implementations remain private.

---

# Storage Model

Runtime information is organized into three tiers.

## Hot

Current execution state.

Examples:

- active browser
- active window
- clipboard
- live observations

---

## Warm

Frequently reused runtime knowledge.

Examples:

- browser graphs
- entity graph
- runtime index
- cached documents
- OCR
- knowledge store

---

## Cold

Historical information.

Examples:

- snapshots
- replay
- execution history
- audit trail

---

# Execution Philosophy

Planning and execution are intentionally separated.

```
Goal

↓

Planner

↓

Execution Plan

↓

Execution Runtime

↓

Verification

↓

Completed Result
```

The planner decides **what** should happen.

The runtime decides **how** it happens.

---

# Runtime Guarantees

The runtime is designed around several guarantees.

- deterministic execution
- immutable snapshots
- typed observations
- rollback support
- replay support
- runtime verification
- explicit approvals
- versioned browser models
- runtime health monitoring

---

# Technology Stack

| Layer | Technology |
|--------|------------|
| Desktop | Tauri v2 |
| Frontend | React |
| Language | TypeScript |
| Styling | TailwindCSS |
| Build | Vite |
| Backend | Bun |
| Database | SQLite |
| ORM | Drizzle |
| Package Manager | pnpm |
| Monorepo | Turborepo |
| Browser Automation | Playwright |
| AI Providers | Ollama, LM Studio, OpenAI Compatible APIs |

---

# Repository Structure

```
usePilot/

├── apps/
│   ├── desktop/
│   └── backend/
│
├── packages/
│   ├── ai-core/
│   ├── ai-providers/
│   ├── config/
│   ├── database/
│   ├── execution-core/
│   ├── execution-types/
│   ├── planner-core/
│   ├── planner-types/
│   ├── runtime-context/
│   ├── ui/
│   ├── types/
│   └── utils/
│
├── docs/
│   ├── architecture/
│   └── adr/
│
└── turbo.json
```

---

# Development

Install dependencies

```bash
pnpm install
```

Start development

```bash
pnpm dev
```

Run tests

```bash
pnpm test
```

Type checking

```bash
pnpm typecheck
```

Lint

```bash
pnpm lint
```

Production build

```bash
pnpm build
```

---

# Documentation

Documentation is organized into:

- Architecture
- ADRs
- Runtime
- Browser
- Database
- Planner
- Execution

Every architectural decision is documented through ADRs.

---

# Design Goals

The project optimizes for:

- correctness over cleverness
- deterministic execution over autonomous guessing
- stable APIs
- explicit boundaries
- local-first computing
- privacy
- maintainability
- extensibility

---

# Non-Goals

usePilot is not:

- a cloud agent platform
- a browser-only automation tool
- an AI wrapper
- a telemetry platform
- an autonomous black-box system

Human approval and deterministic execution remain central to the architecture.

---

# License

Private - All rights reserved.