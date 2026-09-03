# Monorepo Folder Structure

```
usePilot/
├── apps/
│   ├── backend/               # Bun sidecar server
│   │   ├── src/
│   │   │   ├── config/        # Environment and app configuration
│   │   │   ├── events/        # Typed internal EventBus
│   │   │   ├── infrastructure/# Database, HTTP router, WS handler, AI manager
│   │   │   ├── logger/        # Structured JSON logger
│   │   │   └── index.ts       # Server entry point
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── desktop/               # Tauri v2 Desktop App
│       ├── src-tauri/         # Rust desktop wrapper & IPC
│       │   ├── src/
│       │   │   ├── lib.rs     # IPC command handlers
│       │   │   └── main.rs    # Rust entry point
│       │   ├── Cargo.toml
│       │   └── tauri.conf.json
│       ├── src/               # React 19 Frontend
│       │   ├── components/    # Layout, Chat, UI primitives
│       │   ├── routes/        # Welcome, Chat, Settings views
│       │   ├── shared/        # Typed API clients & Zustand store
│       │   ├── styles/        # Global CSS & Design Tokens
│       │   ├── App.tsx        # Router & Providers
│       │   └── main.tsx       # Web entry point
│       ├── package.json
│       └── vite.config.ts
│
├── packages/
│   ├── ai-core/               # Provider interface, streaming helpers, errors
│   ├── ai-providers/          # Ollama, LM Studio, OpenAI-compatible
│   ├── config/                # Centralized schemas & feature flags
│   ├── database/              # SQLite schema, Drizzle ORM, repositories
│   ├── types/                 # Shared TypeScript domain types
│   └── utils/                 # Pure utility functions & Result type
│
├── tooling/
│   └── typescript-config/     # Base, React, and Node tsconfig presets
│
├── docs/                      # Architecture, ADRs, Roadmap
├── turbo.json                 # Turborepo task pipeline
├── pnpm-workspace.yaml        # Monorepo workspace configuration
└── package.json               # Root workspace scripts
```
