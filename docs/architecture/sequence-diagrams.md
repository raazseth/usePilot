# Runtime Sequence Diagrams

This document illustrates the dynamic runtime behavior, cross-subsystem orchestration, lifecycle transitions, and error recovery sequences in usePilot.

---

## 1. End-to-End Execution Lifecycle

The following sequence details how a natural language request transforms into a validated blueprint and executes through adapters, verification, journaling, and timeline indexing:

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as Desktop Frontend
  participant Backend as Backend WS / Router
  participant Planner as Planner Pipeline
  participant Runner as ExecutionRunner
  participant Sched as TaskScheduler
  participant Neg as CapabilityNegotiator
  participant Reg as CapabilityRegistry
  participant Sand as AdapterSandbox
  participant Adapt as CapabilityAdapter
  participant Verif as VerificationEngine
  participant Ctx as RuntimeContextFacade
  participant Jour as ExecutionJournal
  participant Time as ExecutionTimeline
  participant Man as ManifestGenerator

  User->>UI: Submits task prompt
  UI->>Backend: WS message: "plan_and_execute"
  Backend->>Planner: run(prompt, context)
  
  Note over Planner: 14-Stage Planning Pipeline (Classify, Normalize, Extract, Validate, Optimize)
  Planner-->>Backend: ExecutionBlueprint (with SHA-256 hash & DAG)
  Backend->>Runner: run(blueprint, options)
  
  Runner->>Jour: append("execution_started", runId)
  Runner->>Sched: schedule(blueprint)
  Sched-->>Runner: TaskBatch[] (topologically partitioned)

  loop For each TaskBatch
    loop For each Task in Batch (concurrent up to maxParallelism)
      Runner->>Neg: negotiate(task.requiredCapability, context)
      Neg->>Reg: getCandidates(capability)
      Reg-->>Neg: ICapabilityAdapter[]
      Neg-->>Runner: Selected Adapter + NegotiationResult
      
      Runner->>Sand: execute(adapter, adapterContext)
      Sand->>Adapt: execute(ctx)
      Adapt-->>Sand: AdapterResult (success: true, output)
      Sand-->>Runner: SandboxExecutionResult
      
      Runner->>Verif: verify(task, result, blueprint)
      Verif-->>Runner: VerificationResult (passed: true)
      
      Runner->>Ctx: observations.emit(observation)
      Runner->>Jour: append("task_completed", taskId, journalEntryId)
      Runner->>Time: appendEntry(taskId, journalEntryId, observationId)
      Runner->>UI: WS Event: onTaskCompleted(taskId)
    end
    Runner->>Jour: append("checkpoint_created", checkpointId)
  end

  Runner->>Man: generate(runSummary, adapters, policy)
  Man-->>Runner: ExecutionManifest (cryptographically sealed)
  Runner->>Jour: append("execution_completed", manifestHash)
  Runner-->>Backend: ExecutionResult (status: 'completed', report, manifest)
  Backend->>UI: WS Event: onCompleted(result)
  UI->>User: Renders execution report & verification summary
```

---

## 2. Failure Recovery & Deterministic Self-Healing

When an adapter or verification check fails, usePilot enters its self-healing cascade before resorting to failure bundling:

```mermaid
sequenceDiagram
  autonumber
  participant Runner as ExecutionRunner
  participant Sand as AdapterSandbox
  participant Adapt as CapabilityAdapter
  participant Heal as SelfHealingPipeline
  participant Vision as VisionRuntime (OCR/Template)
  participant Verif as VerificationEngine
  participant Bundle as FailureBundleGenerator
  participant Store as ArtifactStore
  participant Jour as ExecutionJournal

  Runner->>Sand: execute(adapter, ctx)
  Sand->>Adapt: execute(ctx)
  Adapt-->>Sand: Target element not found / DOM shift
  Sand-->>Runner: AdapterResult (success: false, error: 'locator_failure')
  
  Note over Runner,Heal: Trigger Deterministic Self-Healing Cascade
  Runner->>Heal: remediate(target, context)
  
  alt Stage 1: DOM Hierarchy Recovery
    Heal->>Adapt: probeAlternativeLocators(target)
    Adapt-->>Heal: Match found
  else Stage 2: Semantic Text Recovery
    Heal->>Adapt: probeByAccessibleName(target)
    Adapt-->>Heal: Match found
  else Stage 3: Visual Template Match
    Heal->>Vision: matchTemplate(screenshot, targetTemplate)
    Vision-->>Heal: Coordinates (x, y)
  else Stage 4: OCR Text Extraction
    Heal->>Vision: findText(screenshot, targetText)
    Vision-->>Heal: Bounding box coordinates
  end

  alt Self-Healing Succeeded
    Heal-->>Runner: RemediationResult (recovered: true, action)
    Runner->>Sand: re-execute with remediated action
    Sand-->>Runner: AdapterResult (success: true)
    Runner->>Verif: verify(task, result, blueprint)
  else Self-Healing Exhausted (Terminal Failure)
    Heal-->>Runner: RemediationResult (recovered: false)
    Runner->>Bundle: generateBundle({ executionId, failureReason, journalEntries })
    Bundle->>Store: save(failure-manifest.json, logs, screenshots)
    Bundle-->>Runner: manifestPath: "failure-bundle/failure-manifest.json"
    Runner->>Jour: append("task_failed", taskId, failureCategory: 'adapter_failure')
    Runner->>Jour: append("execution_failed", runId)
  end
```

---

## 3. Human-in-the-Loop Mandatory Approval Gate

This sequence demonstrates how mandatory approval tasks are isolated into serial execution batches, snapshotting execution state before awaiting user confirmation:

```mermaid
sequenceDiagram
  autonumber
  actor User
  participant UI as Desktop Frontend
  participant Backend as Backend WS
  participant Runner as ExecutionRunner
  participant Sched as TaskScheduler
  participant Check as CheckpointManager
  participant SM as ExecutionStateMachine
  participant Jour as ExecutionJournal

  Runner->>Sched: schedule(blueprint)
  Note over Sched: Task has mandatory approval policy (isolated into single-task serial batch)
  Sched-->>Runner: TaskBatch (tasks: [task_delete_file], canParallelize: false)

  Runner->>Check: createCheckpoint(runId, pendingApprovalTaskId: 'task_delete_file')
  Check-->>Runner: Checkpoint saved to SQLite
  
  Runner->>SM: transitionExecution('waiting_approval')
  Runner->>Jour: append("approval_requested", taskId: 'task_delete_file')
  Runner->>Backend: emit onApprovalRequired(taskId, reason, diff)
  Backend->>UI: WS Broadcast: "approval_required"
  
  UI->>User: Displays approval modal with risk assessment & target file
  
  alt User Approves Task
    User->>UI: Clicks "Approve"
    UI->>Backend: WS message: "resolve_approval" { approved: true }
    Backend->>Runner: resolveApproval(taskId, approved: true)
    Runner->>SM: transitionExecution('running')
    Runner->>Jour: append("approval_received", approved: true)
    Runner->>Runner: Dispatch task to AdapterSandbox
  else User Denies Task
    User->>UI: Clicks "Reject"
    UI->>Backend: WS message: "resolve_approval" { approved: false }
    Backend->>Runner: resolveApproval(taskId, approved: false)
    Runner->>SM: transitionExecution('failed')
    Runner->>Jour: append("approval_received", approved: false, failureCategory: 'approval_denied')
    Runner->>Runner: Abort execution run cleanly
  end
```

---

## 4. Multi-Subsystem Context Transaction with Rollback

Demonstrates atomic multi-store mutations within the Runtime Context Layer:

```mermaid
sequenceDiagram
  autonumber
  participant Caller as ExecutionRunner / Adapter
  participant Facade as RuntimeContextFacade
  participant Tx as ContextTransactionRunner
  participant State as MemoryContextStore
  participant Ent as RuntimeEntityGraph
  participant Obs as ObservationEngine
  participant Know as BrowserKnowledgeGraph

  Caller->>Facade: transaction(async (tx) => { ... })
  Facade->>Tx: execute(callback)
  
  Tx->>State: createSnapshot()
  State-->>Tx: preTxSnapshot (for rollback)
  
  Note over Tx: Begin Transaction Operations
  Tx->>State: tx.state.update(sessionId, draftFn)
  Tx->>Ent: tx.entities.addNode(entityNode)
  Tx->>Ent: tx.entities.link(src, tgt, 'contains')
  Tx->>Obs: tx.observations.emit(observation)
  Tx->>Know: tx.knowledge.recordPage(domain, page)
  
  alt Operations Succeed
    Note over Tx: All mutations validated cleanly
    Tx-->>Facade: Commit transaction
    Facade-->>Caller: Transaction complete
  else An Operation Throws an Error
    Note over Tx: Exception caught! Trigger Compensating Rollback
    Tx->>State: rollbackToSnapshot(preTxSnapshot)
    Tx->>Ent: removeNode(entityNode.id)
    Tx->>Ent: unlink(src, tgt, 'contains')
    Tx->>Obs: purgeObservation(observation.id)
    Tx->>Know: removePage(domain, page.id)
    Tx-->>Facade: Re-throw error with rollback diagnostic
    Facade-->>Caller: Error: Transaction aborted and rolled back cleanly
  end
```
