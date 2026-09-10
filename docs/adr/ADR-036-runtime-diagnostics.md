# ADR-036: Unified Runtime Diagnostics & Observability Dashboard

## Context
Operators need a central vantage point in the desktop application to check subsystem status, observe storage consumption, inspect recent executions, and review structured runtime logs without resorting to terminal logs or raw database inspectors.

## Decision
Introduce the **Diagnostics Dashboard** in the desktop application (`/diagnostics` route):
1. **Subsystem Grid**: Displays real-time health badges and core metrics for Browser, Filesystem, Desktop, Vision, Vault, and Permission subsystems.
2. **Resource Leak Warnings**: Highlights any uncollected browser contexts, pages, or worker threads with one-click cleanup.
3. **Artifact Explorer**: Browses immutable artifacts across executions, tracking storage usage.
4. **Structured Log Viewer**: Displays filterable runtime logs categorized by log level (DEBUG, INFO, WARN, ERROR) and subsystem.

## Consequences
- Elevates usePilot into an observable execution runtime.
- Maintains a structured diagnostics view within the application shell.

