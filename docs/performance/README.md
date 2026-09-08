# Runtime Performance Metrics

The Performance Metrics subsystem records precise timing and resource utilization metrics for executions, tasks, capabilities, and adapters.

## Metrics Captured

- **Task Durations**: Start, execution, and completion durations in milliseconds.
- **Verification Overhead**: Time spent by independent verifiers inspecting real system state.
- **Self-Healing Latency**: Duration of recovery attempts across DOM, Semantic, Visual, and OCR stages.
- **Approval Wait Time**: Total time tasks spend awaiting human authorization.
- **Resource Footprint**: Peak heap memory usage and CPU time deltas.
- **Artifact Output**: Total number and byte volume of artifacts generated.
