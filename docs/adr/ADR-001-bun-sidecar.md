# ADR-001: Bun Sidecar Architecture

## Status
Accepted

## Context
Tauri apps require a high-performance backend runtime to handle database transactions, AI streaming, and local background workloads.

## Decision
Run Bun as a managed child process (sidecar) spawned by the Tauri desktop shell:
- **Zero Node.js dependency**: Bun compiles to a self-contained binary or runs directly with instant startup (<10ms).
- **Native SQLite**: Bun provides built-in, lightning-fast `bun:sqlite` with WAL mode.
- **Dynamic Port Allocation**: The sidecar binds to port 0 (OS dynamically assigns an available port), and prints `BACKEND_PORT={port}` on stdout. The Tauri shell and WebView connect to this verified port.
