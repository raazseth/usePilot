// @usepilot/execution-core — Public API

export { CapabilityRegistry } from './registry'
export { StubAdapter, ALL_CAPABILITIES, createStubAdapterFactory } from './adapters/stub'
export { TaskScheduler } from './scheduler'
export type { TaskBatch } from './scheduler'
export { ExecutionStateMachine } from './state-machine'
export { ApprovalGate } from './approval-gate'
export { VerificationEngine } from './verification'
export { RetryEngine } from './retry'
export type { RetryResult, RetryEventCallback } from './retry'
export { ExecutionJournal, InMemoryJournalBackend } from './journal'
export type { IJournalBackend } from './journal'
export { CheckpointManager, InMemoryCheckpointBackend } from './checkpoint'
export type { ICheckpointBackend } from './checkpoint'
export { ExecutionMetricsCollector } from './metrics'
export { ExecutionRunner } from './runner'
export type { ExecutionCallbacks, RunOptions, RunnerDependencies } from './runner'
export { AdapterSandbox } from './sandbox'
export { PolicyBasedCapabilityNegotiator } from './negotiator'
export { ExecutionResourceManager } from './resource-manager'
export { CancellationTokenSource } from './token'
export type { CancellationToken } from './token'
export { AdapterSession } from './session/session'
export { SessionManager } from './session/manager'
export { ExecutionPolicyEngine, createDefaultExecutionPolicy } from './policy/engine'
export { ManifestGenerator } from './manifest/generator'

import { CapabilityRegistry } from './registry'
import { ALL_CAPABILITIES, createStubAdapterFactory } from './adapters/stub'
import { TaskScheduler } from './scheduler'
import { ExecutionStateMachine } from './state-machine'
import { ApprovalGate } from './approval-gate'
import { RetryEngine } from './retry'
import { ExecutionJournal } from './journal'
import { CheckpointManager } from './checkpoint'
import { ExecutionMetricsCollector } from './metrics'
import { ExecutionRunner } from './runner'

export function createDefaultRegistry(): CapabilityRegistry {
  const registry = new CapabilityRegistry()
  for (const cap of ALL_CAPABILITIES) {
    registry.register({
      factory: createStubAdapterFactory(cap),
      capability: cap,
      priority: 0,
      platformSupport: [],
      name: 'StubAdapter',
    })
  }
  return registry
}

export function createExecutionRunner(
  runId: string,
  traceId: string,
  registry?: CapabilityRegistry
): { runner: ExecutionRunner; deps: ReturnType<typeof buildDeps> } {
  const deps = buildDeps(runId, traceId, registry ?? createDefaultRegistry())
  const runner = new ExecutionRunner(deps)
  return { runner, deps }
}

function buildDeps(runId: string, traceId: string, registry: CapabilityRegistry) {
  return {
    registry,
    scheduler: new TaskScheduler(),
    stateMachine: new ExecutionStateMachine(),
    approvalGate: new ApprovalGate(),
    retryEngine: new RetryEngine(),
    journal: new ExecutionJournal(),
    checkpoints: new CheckpointManager(runId),
    metrics: new ExecutionMetricsCollector(runId, traceId),
  }
}
