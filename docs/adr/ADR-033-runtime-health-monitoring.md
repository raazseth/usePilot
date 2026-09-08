# ADR-033: Subsystem Runtime Health Monitoring & Resource Leak Detection

## Context
Long-running AI computer operators may suffer from memory bloat, abandoned browser contexts, zombie OCR workers, or open file handles over multiple workflows. Operating reliably requires active subsystem health tracking and leak detection.

## Decision
Implement `RuntimeHealthMonitor` and `ResourceLeakDetector`:
1. **Subsystem Health Status**: Exposes `HealthStatus` across Browser, Filesystem, Desktop, Vision, Vault, and Permission Manager (`healthy`, `degraded`, `unhealthy`).
2. **Resource Tracking**: Tracks allocation timestamps, creators, and disposal hooks for browser contexts, pages, OCR workers, and adapter sessions.
3. **Leak Detection**: Flags resources exceeding expected operational lifespans as warnings in health reports.
4. **Automated Teardown**: Exposes `cleanupAllLeakedResources()` ensuring zero leaked processes or contexts upon execution shutdown.

## Consequences
- Guarantees long-term runtime stability without requiring application restarts.
- Immediate visibility into subsystem performance degradation.
