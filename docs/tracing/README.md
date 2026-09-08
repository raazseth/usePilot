# Browser Trace Recording

The Browser Trace Recorder captures full execution traces directly from Playwright contexts.

## Capabilities

- **Playwright Trace Archive**: Exports complete `.zip` archives containing step-by-step action replays, DOM snapshots, network waterfalls, and console logs.
- **Console & Network Interception**: Records page `console.log` / `console.error` events and HTTP request/response statuses in real time.
- **Selector Failure Logging**: Keeps track of selectors that timed out or failed before self-healing activated.
- **Artifact Store Integration**: Every trace is automatically archived into `artifact://<runId>/browser/trace-<taskId>.zip` for immediate opening in the desktop UI or Playwright Trace Viewer (`npx playwright show-trace <path>`).
