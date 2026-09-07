# ADR-020: Policy-Based Capability Negotiation

## Context
Static capability resolution based solely on hardcoded priority integers is fragile in cross-platform environments and fails to account for runtime availability, OS compatibility, or system constraints.

## Decision
Introduce `ICapabilityNegotiator` and `PolicyBasedCapabilityNegotiator`. Instead of picking the first registered adapter blindly:
1. `CapabilityRegistry.getCandidates(capability)` retrieves all candidate adapters registered for a requested capability.
2. The negotiator evaluates each candidate against active platform requirements (`windows`, `macos`, `linux`), runtime probes (`isAvailable()`), and task constraints.
3. The negotiator scores and selects the best candidate, returning a structured `NegotiationResult` detailing the chosen adapter, candidates evaluated, and decision rationale.
4. The negotiation rationale is recorded in the execution journal for auditability.

## Consequences
- Decouples task execution from static adapter bindings.
- Enables seamless fallback when preferred adapters are unavailable (e.g., missing CLI binary or unsupported OS).
- Provides clear explanatory traces when capability negotiation succeeds or fails.
