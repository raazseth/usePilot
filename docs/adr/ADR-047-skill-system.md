# ADR-047: Skill System — Product-Facing Capabilities, Declarative Invariants, and Workflow Compilation

## Status
Accepted

## Context
Prior to Phase 6, usePilot provided low-level primitive capabilities across browser, native filesystem, desktop, and vision runtimes (e.g., `filesystem.search`, `filesystem.move`, `browser.navigate`, `browser.extract`), managed by a deterministic Planner, DAG Scheduler, and Execution Runner. 

However, users specify high-level goals rather than single capability calls:
- "Organize my Downloads by file type."
- "Research this company and save the report to my Documents."
- "Download all PDF invoices from this portal and organize them into Finance."

Directly asking an LLM to generate raw execution graphs from scratch without reusable abstractions led to inconsistent task sequencing, bypassed approval gates, and unreliable verification. We required a first-class **Product Capability Layer** that structures reusable user-facing abilities while strictly adhering to all existing architectural guarantees:

```text
User Goal -> Intent -> Skill Discovery -> Skill Selection -> Skill Configuration -> Workflow -> Existing Planner -> ExecutionBlueprint -> Execution Engine -> Verification -> Outcome
```

## Decision

### 1. Dedicated Packages (`@usepilot/skill-types` and `@usepilot/skill-core`)
We introduced two focused packages maintaining clean architectural separation:
- `@usepilot/skill-types`: Domain interfaces for `Skill`, `SkillManifest`, `WorkflowDefinition`, `SkillCandidate`, `SkillResolution`, and `SkillExecutionTelemetry`.
- `@usepilot/skill-core`: The operational engine providing `SkillRegistry`, `SkillDiscovery`, `SkillResolver`, `SkillWorkflowCompiler`, `SkillComposer`, `SkillVerifier`, and 10 built-in production skills.

### 2. Architectural Invariants
The Skill layer is bound to 10 strict invariants:
1. **Skill > Capability**: A Skill is a composite user ability; capabilities are primitive runtime actions. Skills compose capabilities.
2. **Skill -> Planner**: Skills do not replace the planner. The existing `Planner` and `GraphBuilder` remain authoritative for dependency ordering, cycle detection, and scheduling.
3. **Skill -> ExecutionBlueprint -> Execution Engine**: No alternate execution engine exists. All actions run through `ExecutionRunner` and capability adapters.
4. **Authoritative Verification**: Task completion does not equate to Skill success. Every Skill defines post-execution semantic verification contracts (e.g., confirming files exist at destination, hashes match, or extracted fields are non-empty).
5. **Non-Bypassable Approvals & Permissions**: High-risk tasks (e.g., form submissions, file modifications) declare explicit approval policies (`mandatory`). `SkillWorkflowCompiler` enforces that approval policies cannot be downgraded by optimization passes.
6. **No Direct OS/Browser Execution**: Skills do not invoke raw shell or browser APIs; all operations target validated runtime adapters.
7. **Deterministic Discovery & Resolution**: Discovery prioritizes token-based matching and explicit capability filters. Inputs are validated with Zod schemas. If required inputs are missing, structured resolution objects prompt the user rather than guessing or hallucinating inputs.
8. **Composition with Explicit Data Binding**: Skills compose via `SkillComposer` with typed step input/output bindings (`$var` / `workflow_input`).
9. **Traceability & Versioning**: Skills are immutable manifests with explicit semantic versioning (`@1.0.0`). Execution telemetry captures `skillId`, `skillVersion`, `runId`, `traceId`, `failureCategory`, and approval audits.
10. **Zero Global Singletons**: Registry, discovery, resolver, and compiler are instantiable classes supporting dependency injection.

### 3. Initial Built-in Skills
We implemented 10 real production-ready skills across three categories:
- **Filesystem**:
  1. `find-files@1.0.0`: Locates files matching glob/pattern criteria.
  2. `organize-downloads@1.0.0`: Groups directory contents into categorized folders by extension, file type, or date.
  3. `bulk-rename@1.0.0`: Batch renames files with regex/prefix/timestamp templates.
  4. `duplicate-detection@1.0.0`: Computes hashes and groups identical files for user review without destructive deletion.
- **Browser**:
  5. `research-website@1.0.0`: Navigates domains, crawls key pages, extracts text, and stores references.
  6. `extract-website-data@1.0.0`: Scrapes structured tabular/item data from target URLs.
  7. `download-documents@1.0.0`: Discovers and downloads document links (PDFs, reports) into local storage.
  8. `fill-web-form@1.0.0`: Fills online forms with provided data; enforces `mandatory` approval gate prior to form submission.
- **Cross-Runtime**:
  9. `download-and-organize@1.0.0`: Orchestrates browser document downloads directly into organized filesystem hierarchies.
  10. `research-and-save-report@1.0.0`: Researches web targets, aggregates knowledge, and generates structured markdown/text reports saved directly to the user's filesystem.

### 4. Desktop UI Integration
The desktop application provides a dedicated `/skills` view presenting the catalog of available skills, risk indicators, parameter configuration forms, missing-input prompts, and execution progress tracking.

## Consequences
- **User Intent Grounding**: Users execute predictable, tested workflows rather than open-ended prompt interpretations.
- **Complete Reusability**: Common automations are packaged as versioned, verified abilities with explicit inputs and outputs.
- **Zero Architecture Drift**: Planner, Execution Engine, Journal, Approval Engine, and Verification Engine remain strictly authoritative.
