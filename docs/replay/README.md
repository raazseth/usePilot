# Observation Replay Subsystem

The **Observation Replay Subsystem** deterministically reproduces the perceived state of past executions.

## Features
- **Stepped Playback**: `stepForward()`, `stepBackward()`, and `seekTo()`.
- **State Projection**: Carries forward latest known URLs, DOM fingerprints, filesystem changes, vision bounding boxes, and verification assertions at each step.
- **Read-Only**: Zero destructive live tool executions during replay.
- **UI Integration**: Powers the History tab in `/context`.
