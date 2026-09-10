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
export { ExecutionTimelineBuilder } from './timeline'

// Phase 4: Production Capability Runtimes
export { NativeFilesystemAdapter } from './adapters/filesystem/fs-adapter'
export { NativeDesktopAdapter } from './adapters/desktop/desktop-adapter'
export { PlaywrightBrowserAdapter } from './adapters/browser/browser-adapter'
export { PlaywrightBrowserSession } from './adapters/browser/browser-session'
export { VisionSubsystem } from './vision/vision-subsystem'
export { SelfHealingPipeline } from './healing/self-healing'
export { SecretVault } from './security/vault'
export { PermissionManager } from './security/permissions'
export { BrowserStateVerifier, FilesystemVerifier, DesktopStateVerifier } from './verification/capability-verifiers'

// Phase 4.1: Production Hardening & Observability
export { ArtifactStore } from './artifacts/artifact-store'
export { ArtifactManager } from './artifacts/artifact-manager'
export type { ArtifactType, ArtifactCategory, ArtifactMetadata, SaveArtifactOptions, ListArtifactFilter } from './artifacts/types'
export { BrowserTraceRecorder } from './tracing/trace-recorder'
export type { BrowserTraceSummary, ConsoleLogEntry, NetworkLogEntry } from './tracing/trace-recorder'
export { RuntimeHealthMonitor } from './diagnostics/health-monitor'
export { ResourceLeakDetector } from './diagnostics/leak-detector'
export type { HealthStatus, SystemHealthReport, SubsystemHealthState, ResourceLeakWarning, TrackedResourceType } from './diagnostics/health-types'
export { DiagnosticTimelineBuilder } from './diagnostics/diagnostic-timeline'
export type { TimelineEvent, TimelineEventType } from './diagnostics/diagnostic-timeline'
export { PerformanceMetricsCollector } from './diagnostics/performance-collector'
export type { TaskPerformanceRecord, ExecutionPerformanceSummary } from './diagnostics/performance-collector'
export { ExecutionReplayEngine } from './replay/replay-engine'
export type { ReplayFrame } from './replay/replay-engine'
export { FailureBundleGenerator } from './replay/failure-bundle'
export type { FailureBundleManifest } from './replay/failure-bundle'
export { RuntimeLogger } from './logging/runtime-logger'
export type { RuntimeLogEntry, RuntimeLogLevel, SearchLogFilter } from './logging/runtime-logger'

import type { TaskCapability } from '@usepilot/planner-types'

import { PlaywrightBrowserAdapter } from './adapters/browser/browser-adapter'
import { NativeDesktopAdapter } from './adapters/desktop/desktop-adapter'
import { NativeFilesystemAdapter } from './adapters/filesystem/fs-adapter'
import { ALL_CAPABILITIES, createStubAdapterFactory } from './adapters/stub'
import { ApprovalGate } from './approval-gate'
import { CheckpointManager } from './checkpoint'
import { ExecutionJournal } from './journal'
import { ExecutionMetricsCollector } from './metrics'
import { CapabilityRegistry } from './registry'
import { RetryEngine } from './retry'
import { ExecutionRunner } from './runner'
import { TaskScheduler } from './scheduler'
import { ExecutionStateMachine } from './state-machine'


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

export function createProductionRegistry(): CapabilityRegistry {
  const registry = createDefaultRegistry()

  // Register NativeFilesystemAdapter
  const fsCaps: TaskCapability[] = ['read_file', 'write_file', 'move_file', 'delete_file']
  for (const cap of fsCaps) {
    registry.register({
      factory: () => new NativeFilesystemAdapter(cap),
      capability: cap,
      priority: 100,
      platformSupport: ['windows', 'macos', 'linux'],
      name: 'NativeFilesystemAdapter',
    })
  }

  // Register NativeDesktopAdapter
  const desktopCaps: TaskCapability[] = ['read_clipboard', 'write_clipboard', 'execute_command']
  for (const cap of desktopCaps) {
    registry.register({
      factory: () => new NativeDesktopAdapter(cap),
      capability: cap,
      priority: 100,
      platformSupport: ['windows', 'macos', 'linux'],
      name: 'NativeDesktopAdapter',
    })
  }

  // Register PlaywrightBrowserAdapter
  const browserCaps: TaskCapability[] = [
    'navigate_website',
    'search_web',
    'authenticate_user',
    'extract_web_data',
    'download_file',
  ]
  for (const cap of browserCaps) {
    registry.register({
      factory: () => new PlaywrightBrowserAdapter(cap),
      capability: cap,
      priority: 100,
      platformSupport: ['windows', 'macos', 'linux'],
      name: 'PlaywrightBrowserAdapter',
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
