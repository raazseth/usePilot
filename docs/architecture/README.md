# usePilot Architecture Documentation

This directory contains the central architectural specifications, data lifecycle models, sequence diagrams, and public API reference for the usePilot system.

---

## 1. What is this?

The architecture documentation defines the top-level structural design of usePilot. It covers process boundaries (Tauri desktop shell, Bun backend sidecar, and React frontend), IPC protocols, tiered storage policies, end-to-end execution flows, and public interface boundaries across all monorepo packages.

---

## 2. Why does it exist?

usePilot is an autonomous yet strictly deterministic local-first desktop agent. To prevent architectural drift, ensure strong safety boundaries, and eliminate circular dependencies across monorepo packages, this directory provides the formal technical contract that every package and subsystem must adhere to.

Key architectural requirements documented here:
- **Separation of Reasoning and Execution**: LLMs generate blueprints through the Planner; execution is handled exclusively by a deterministic state machine.
- **Single Public API Boundary**: System state, perceptions, and knowledge are accessed exclusively through `RuntimeContextFacade`.
- **Zero Cloud Dependence**: All execution, indexing, storage, and recovery mechanisms operate locally without external daemons.

---

## 3. Documents in this Directory

| Document | Purpose |
|---|---|
| [System Overview](overview.md) | High-level system architecture, subsystem topologies, and process boundaries |
| [Ownership & Lifecycle Matrix](ownership-matrix.md) | Object ownership, mutability constraints, storage tiers, and mutation boundaries |
| [Sequence Diagrams](sequence-diagrams.md) | Visual Mermaid sequences for execution, self-healing, approvals, and transactions |
| [Public API Reference & Parity Matrix](public-api-reference.md) | Canonical exports, documentation mapping, code examples, and anti-patterns |
| [Monorepo Folder Structure](folder-structure.md) | Directory structure across apps, packages, and tooling |
| [Development Setup](dev-setup.md) | Prerequisites, local installation, and development workflows |

---

## 4. Key Subsystems & Collaborators

- [Planner Subsystem](../planner/README.md): Consumes user objectives and constructs validated, DAG-ordered `ExecutionBlueprint`s.
- [Execution Subsystem](../execution/README.md): Consumes blueprints and coordinates capability adapters, verification, and sandboxes.
- [Runtime Context](../runtime-context/README.md): Tiered operating memory and unified facade providing state, perception, and knowledge access.
- [Architectural Decision Records (ADRs)](../adr/README.md): Complete rationale and trade-off analysis for every architectural decision.

---

## 5. Where should I go next?

- To understand the end-to-end process topology, read [System Overview](overview.md).
- To inspect object lifecycles and storage rules, read [Ownership & Lifecycle Matrix](ownership-matrix.md).
- To see how errors and approval gates are handled at runtime, inspect [Sequence Diagrams](sequence-diagrams.md).
- To use the programmatic interfaces, inspect [Public API Reference & Parity Matrix](public-api-reference.md).
- To return to the master index, view [Documentation Index](../README.md).
