# Runtime Diagnostics & Observability

The Runtime Diagnostics subsystem aggregates real-time health, performance metrics, and operational logs across all capabilities.

## Components

1. **`RuntimeHealthMonitor`**: Continuously monitors the operational state and uptime of Browser, Filesystem, Desktop, Vision, Vault, and Permission subsystems.
2. **`ResourceLeakDetector`**: Tracks active handles and browser pages to prevent memory leaks across executions.
3. **`DiagnosticTimelineBuilder`**: Assembles a unified chronological timeline linking journal entries, self-healing events, and created artifacts.
4. **`RuntimeLogger`**: Provides structured JSON/text logging categorized by log levels (`DEBUG`, `INFO`, `WARN`, `ERROR`).
