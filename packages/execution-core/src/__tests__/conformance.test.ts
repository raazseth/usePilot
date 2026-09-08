import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe } from 'vitest'

import { runAdapterConformanceSuite } from './conformance/conformance-suite'
import { NativeDesktopAdapter } from '../adapters/desktop/desktop-adapter'
import { NativeFilesystemAdapter } from '../adapters/filesystem/fs-adapter'
import { StubAdapter } from '../adapters/stub'

describe('Adapter Conformance Suite Runs', () => {
  const blueprint: ExecutionBlueprint = {
    id: 'bp-conf-1',
    version: 1,
    hash: 'hash-conf-1',
    goal: {
      id: 'g-c1',
      primaryObjective: 'Conformance testing',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'compliant',
      confidence: 1,
      status: 'validated',
      normalizedInput: { text: 'test', originalText: 'test', detectedLanguage: 'en', entities: [], durationMs: 0 },
      createdAt: Date.now(),
    },
    intent: {
      type: 'research',
      complexity: 'low',
      riskLevel: 'low',
      requiresHumanApproval: false,
      missingInformation: [],
      confidence: 1,
      durationMs: 5,
    },
    tasks: [],
    graph: { nodes: [], edges: [], parallelGroups: [], criticalPath: [], taskCount: 0, depth: 0 },
    approvals: { requiresMandatoryApproval: false, hasForbiddenTasks: false, mandatoryTaskIds: [], optionalTaskIds: [], forbiddenTaskIds: [] },
    successCriteria: [],
    estimatedComplexity: 'low',
    optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
    plannerContext: { platform: 'windows', availableTools: [], settingsSnapshot: {}, previousBlueprintCount: 0 },
    createdAt: Date.now(),
  }

  // 1. StubAdapter Conformance
  const stubTask: Task = {
    id: 't-stub',
    title: 'Stub task',
    description: 'Stub test',
    category: 'computation',
    requiredCapability: 'none',
    preconditions: [],
    postconditions: [],
    successConditions: ['Simulated task completed'],
    failureConditions: [],
    dependsOn: [],
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 100, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 1,
  }
  runAdapterConformanceSuite('StubAdapter', {
    createAdapter: () => new StubAdapter('none'),
    sampleTask: stubTask,
    blueprint,
  })

  // 2. NativeFilesystemAdapter Conformance
  const testFile = join(tmpdir(), `conformance-fs-${Date.now()}.txt`)
  const fsTask: Task = {
    id: 't-fs-conf',
    title: 'Write test file',
    description: 'FS conformance',
    category: 'computation',
    requiredCapability: 'write_file',
    toolConfig: { path: testFile, content: 'Conformance Test' },
    preconditions: [],
    postconditions: [],
    successConditions: ['File written'],
    failureConditions: [],
    dependsOn: [],
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 100, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 1,
  }
  runAdapterConformanceSuite('NativeFilesystemAdapter', {
    createAdapter: () => new NativeFilesystemAdapter('write_file'),
    sampleTask: fsTask,
    blueprint,
  })

  // 3. NativeDesktopAdapter Conformance
  const desktopTask: Task = {
    id: 't-desktop-conf',
    title: 'Desktop clipboard',
    description: 'Desktop conformance',
    category: 'computation',
    requiredCapability: 'write_clipboard',
    toolConfig: { text: 'Conformance Clipboard Text' },
    preconditions: [],
    postconditions: [],
    successConditions: ['Clipboard written'],
    failureConditions: [],
    dependsOn: [],
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 100, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 1,
  }
  runAdapterConformanceSuite('NativeDesktopAdapter', {
    createAdapter: () => new NativeDesktopAdapter('write_clipboard'),
    sampleTask: desktopTask,
    blueprint,
  })
})
