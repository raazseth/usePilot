# Developer Setup Guide

## Prerequisites

* **Node.js**: >= 20.x
* **pnpm**: >= 9.x (`npm install -g pnpm`)
* **Bun**: >= 1.1.x (`powershell -c "irm bun.sh/install.ps1 | iex"`)
* **Rust & Cargo**: >= 1.75.x (`rustup`)
* **Ollama** (optional for local LLM): Download from [ollama.ai](https://ollama.ai)

## Quick Start

```bash
# 1. Install all dependencies
pnpm install

# 2. Build all shared packages
pnpm build

# 3. Run typecheck across entire monorepo
pnpm -r typecheck

# 4. Run tests
pnpm test

# 5. Start development servers
# Terminal 1: Backend sidecar (hot reload)
pnpm --filter @usepilot/backend dev

# Terminal 2: Desktop frontend (Vite)
pnpm --filter @usepilot/desktop dev

# Terminal 3: Tauri desktop shell
pnpm --filter @usepilot/desktop tauri dev
```
