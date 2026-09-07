# Capability Negotiation

## Overview

In usePilot, the planner defines capabilities (e.g., `web.download`, `filesystem.write`, `system.command`), rather than concrete adapter implementations. During execution, the `PolicyBasedCapabilityNegotiator` dynamically matches each task's required capability to the most appropriate runtime adapter.

## Negotiation Flow

```text
Task.requiredCapability
          │
          ▼
CapabilityRegistry.getCandidates(capability)
          │
          ▼
PolicyBasedCapabilityNegotiator.negotiate(candidates, context)
          ├── 1. Filter by Supported Platforms (windows / macos / linux)
          ├── 2. Probe Availability (adapter.isAvailable())
          ├── 3. Filter by Task Constraints (if specified)
          └── 4. Sort by Priority (descending)
          │
          ▼
Selected Adapter + NegotiationResult (rationale, candidatesEvaluated)
          │
          ▼
Recorded to Execution Journal
```

## Negotiation Result Contract

```typescript
export interface NegotiationResult {
  selectedAdapter: ICapabilityAdapter
  candidatesEvaluated: number
  rationale: string
}
```

If no candidate satisfies the platform and availability criteria, negotiation throws a descriptive error detailing why candidates were rejected (e.g., unavailable CLI binary or OS incompatibility), which transitions the task cleanly into failure category `configuration`.
