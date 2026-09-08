# Execution Replay Engine

The Execution Replay Engine visualizes past workflow executions without executing any side-effects.

## How Replay Works

1. **Idempotent Inspection**: Replay reads strictly from the `ExecutionJournal` and the `ArtifactStore`. It never issues network requests, launches processes, or touches live systems.
2. **Timeline Frame Stepper**: Converts chronological journal actions into interactive `ReplayFrame`s showing:
   - Current task description and capability
   - Live screenshot at that exact moment (if captured)
   - Associated DOM snapshot or downloaded artifact
   - Self-healing interventions and verification results
3. **Auditing & Forensic Debugging**: Allows operators to review exactly what the AI agent did and verify compliance before running similar workflows in the future.
