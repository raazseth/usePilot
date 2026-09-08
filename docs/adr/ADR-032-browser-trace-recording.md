# ADR-032: Playwright Browser Trace Recording as Artifacts

## Context
Debugging complex web automation failures (e.g. dynamic bot mitigations, subtle timing differences, network timeouts) is challenging with only terminal error logs. Developers and users need to inspect exactly what the browser saw, how the network responded, and which selectors failed.

## Decision
Implement `BrowserTraceRecorder` directly hooking into Playwright's native tracing API:
1. **Comprehensive Capture**: Intercepts console logs, network request/response timing, DOM snapshots, failed selectors, and screenshot timelines.
2. **Native Trace Export**: Automatically serializes Playwright zip traces into the `ArtifactStore` as `artifact://<runId>/browser/trace-<taskId>.zip`.
3. **Execution Report Integration**: Flags `hasTrace: true` and includes the artifact reference in execution reports so users can open traces directly in Playwright Trace Viewer or the desktop UI.

## Consequences
- Deep, zero-overhead browser observability during execution.
- Enables post-mortem analysis of web interactions without re-executing against live production websites.
