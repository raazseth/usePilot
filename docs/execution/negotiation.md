# Capability Negotiation

## Overview

In usePilot, the planner produces blueprints specifying required capabilities (e.g., `navigate_website`, `read_file`, `execute_command`), rather than concrete adapter implementations. During execution, the `PolicyBasedCapabilityNegotiator` dynamically matches each task's required capability to the most suitable runtime adapter.

## Capability Dependency Graph

The execution runtime consults the static `CAPABILITY_DEPENDENCY_GRAPH` to validate underlying prerequisites before dispatching tasks:

```typescript
export type DependencyRelationType = 'required' | 'optional' | 'fallback'

export interface SubsystemDependency {
  readonly subsystem: 'browser' | 'desktop' | 'filesystem' | 'vision'
  readonly type: DependencyRelationType
}

export interface PermissionDependency {
  readonly permission: 'browser' | 'filesystem' | 'network' | 'shell' | 'desktop_control'
  readonly type: DependencyRelationType
}

export interface CapabilityDependencyRequirement {
  readonly capability: TaskCapability
  readonly subsystems: readonly SubsystemDependency[]
  readonly permissions: readonly PermissionDependency[]
  readonly requiredSubsystems: readonly ('browser' | 'desktop' | 'filesystem' | 'vision')[]
  readonly requiredPermissions: readonly ('browser' | 'filesystem' | 'network' | 'shell' | 'desktop_control')[]
}
```

For instance:
- `download_file` requires both `browser` and `filesystem` subsystems, with `browser` and `filesystem` permissions.
- `search_web` requires `browser` with `network` permissions, and declares `desktop` as a `fallback`.
- `authenticate_user` requires `browser` and declares `vision` as `optional`.

## Negotiation Flow

```text
Task.requiredCapability
          │
          ▼
CAPABILITY_DEPENDENCY_GRAPH Check
(Subsystems & Permissions Validated)
          │
          ▼
CapabilityRegistry.getCandidates(capability)
          │
          ▼
PolicyBasedCapabilityNegotiator.negotiate(candidates, context)
          ├── 1. Filter by Supported Platforms (windows / macos / linux)
          ├── 2. Probe Availability (adapter.isAvailable())
          ├── 3. Match Policy Preferences (ExecutionPolicy.adapter.preferredAdapters)
          └── 4. Sort by Priority (descending)
          │
          ▼
Selected Adapter + NegotiationResult (rationale, candidatesEvaluated)
          │
          ▼
Recorded to Execution Journal & Timeline
```

## Negotiation Result Contract

```typescript
export interface NegotiationResult {
  selectedAdapter: ICapabilityAdapter
  candidatesEvaluated: number
  rationale: string
}
```

If no candidate satisfies the platform and availability criteria, negotiation throws a structured error detailing rejection reasons (e.g., missing binary or unmet OS permissions), categorizing the failure as `configuration` or `capability_failure`.

