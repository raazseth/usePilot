# usePilot

A privacy-first desktop AI assistant that understands natural language goals and helps users accomplish tasks — entirely on their own machine.

## Philosophy

- **Local-first** — All data stays on your device
- **Privacy by default** — No telemetry, no analytics, no hidden network requests
- **Open provider** — Works with Ollama, LM Studio, and any OpenAI-compatible API
- **Extensible architecture** — Built to grow from chat assistant to autonomous agent

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop | Tauri v2 |
| Frontend | React + TypeScript + Vite + TailwindCSS |
| Backend | Bun (TypeScript sidecar) |
| Database | SQLite + Drizzle ORM |
| Monorepo | TurboRepo + pnpm |
| AI Providers | Ollama, LM Studio, OpenAI-compatible |

## Getting Started

See [docs/architecture/dev-setup.md](./docs/architecture/dev-setup.md) for full setup instructions.

### Quick Start

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev
```

## Project Structure

```
usePilot/
├── apps/
│   ├── desktop/     # Tauri v2 + React frontend
│   └── backend/     # Bun sidecar (DDD architecture)
├── packages/
│   ├── ai-core/     # AI provider interface
│   ├── ai-providers/ # Ollama, LM Studio, OpenAI
│   ├── database/    # Drizzle schema + migrations
│   ├── config/      # Centralized configuration
│   ├── types/       # Shared domain types
│   ├── utils/       # Pure utilities
│   └── ui/          # Component library
└── docs/            # Architecture docs + ADRs
```

## Documentation

- [Architecture Overview](./docs/architecture/overview.md)
- [Development Setup](./docs/architecture/dev-setup.md)
- [ADR-000: Project Philosophy](./docs/adr/ADR-000-project-philosophy.md)

## License

Private — All rights reserved.

# usePilot
