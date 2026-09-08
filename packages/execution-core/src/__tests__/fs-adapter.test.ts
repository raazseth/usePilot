import { existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { NativeFilesystemAdapter } from '../adapters/filesystem/fs-adapter'


describe('NativeFilesystemAdapter', () => {
  const testDir = join(tmpdir(), `usepilot-fs-test-${Date.now()}`)

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  const dummyBlueprint: ExecutionBlueprint = {
    id: 'bp-fs-1',
    version: 1,
    hash: 'hash-fs-1',
    goal: {
      id: 'goal-1',
      primaryObjective: 'FS operations',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'done',
      confidence: 1,
      status: 'validated',
      normalizedInput: { text: 'test', originalText: 'test', detectedLanguage: 'en', entities: [], durationMs: 0 },
      createdAt: Date.now(),
    },
    intent: {
      type: 'filesystem',
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

  it('performs atomic writes and verifies content and checksum', async () => {
    const adapter = new NativeFilesystemAdapter('write_file', { workingDirectory: testDir })
    await adapter.initialize()

    const targetPath = join(testDir, 'invoice.txt')
    const sampleTask: Task = {
      id: 'task-w1',
      title: 'Write invoice',
      description: 'Writes invoice text file',
      category: 'computation',
      requiredCapability: 'write_file',
      toolConfig: { path: targetPath, content: 'Invoice GST Total: ₹15,000' },
      preconditions: [],
      postconditions: [],
      successConditions: ['File exists with content'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: sampleTask,
      blueprint: dummyBlueprint,
      runId: 'run-w1',
      traceId: 'tr-w1',
      signal: new AbortController().signal,
    }

    const result = await adapter.execute(ctx)
    expect(result.success).toBe(true)
    expect(existsSync(targetPath)).toBe(true)
    expect(readFileSync(targetPath, 'utf8')).toBe('Invoice GST Total: ₹15,000')

    const verification = await adapter.verify(ctx, result)
    expect(verification.passed).toBe(true)
    expect(verification.checkedConditions.length).toBeGreaterThan(0)
  })

  it('reads file and computes SHA-256 hash', async () => {
    const writeAdapter = new NativeFilesystemAdapter('write_file', { workingDirectory: testDir })
    const targetPath = join(testDir, 'data.json')
    await writeAdapter.execute({
      task: {
        id: 't-init',
        title: 'Init',
        description: 'Init data',
        category: 'computation',
        requiredCapability: 'write_file',
        toolConfig: { path: targetPath, content: '{"status": "ok"}' },
        preconditions: [],
        postconditions: [],
        successConditions: [],
        failureConditions: [],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 1,
      },
      blueprint: dummyBlueprint,
      runId: 'r-init',
      traceId: 'tr-init',
      signal: new AbortController().signal,
    })

    const readAdapter = new NativeFilesystemAdapter('read_file', { workingDirectory: testDir })
    const result = await readAdapter.execute({
      task: {
        id: 't-read',
        title: 'Read',
        description: 'Read file',
        category: 'computation',
        requiredCapability: 'read_file',
        toolConfig: { path: targetPath },
        preconditions: [],
        postconditions: [],
        successConditions: [],
        failureConditions: [],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 1,
      },
      blueprint: dummyBlueprint,
      runId: 'r-read',
      traceId: 'tr-read',
      signal: new AbortController().signal,
    })

    expect(result.success).toBe(true)
    const out = result.output as { content: string; hash: string }
    expect(out.content).toBe('{"status": "ok"}')
    expect(out.hash.length).toBe(64)
  })

  it('moves and renames files with independent verification', async () => {
    const writeAdapter = new NativeFilesystemAdapter('write_file', { workingDirectory: testDir })
    const src = join(testDir, 'raw.csv')
    const dest = join(testDir, 'processed', '2026-invoices.csv')

    await writeAdapter.execute({
      task: {
        id: 't-prep',
        title: 'Prep',
        description: 'Prep file',
        category: 'computation',
        requiredCapability: 'write_file',
        toolConfig: { path: src, content: 'id,amount\n1,500' },
        preconditions: [],
        postconditions: [],
        successConditions: [],
        failureConditions: [],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 1,
      },
      blueprint: dummyBlueprint,
      runId: 'r-prep',
      traceId: 'tr-prep',
      signal: new AbortController().signal,
    })

    const moveAdapter = new NativeFilesystemAdapter('move_file', { workingDirectory: testDir })
    const moveTask: Task = {
      id: 't-move',
      title: 'Move file',
      description: 'Move to processed folder',
      category: 'computation',
      requiredCapability: 'move_file',
      toolConfig: { source: src, destination: dest },
      preconditions: [],
      postconditions: [],
      successConditions: ['File moved to destination'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: moveTask,
      blueprint: dummyBlueprint,
      runId: 'r-mv',
      traceId: 'tr-mv',
      signal: new AbortController().signal,
    }

    const result = await moveAdapter.execute(ctx)
    expect(result.success).toBe(true)
    expect(existsSync(src)).toBe(false)
    expect(existsSync(dest)).toBe(true)

    const verification = await moveAdapter.verify(ctx, result)
    expect(verification.passed).toBe(true)
  })

  it('deletes files and verifies deletion', async () => {
    const writeAdapter = new NativeFilesystemAdapter('write_file', { workingDirectory: testDir })
    const target = join(testDir, 'temp-junk.txt')
    await writeAdapter.execute({
      task: {
        id: 't-junk',
        title: 'Junk',
        description: 'Junk file',
        category: 'computation',
        requiredCapability: 'write_file',
        toolConfig: { path: target, content: 'temp' },
        preconditions: [],
        postconditions: [],
        successConditions: [],
        failureConditions: [],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 1,
      },
      blueprint: dummyBlueprint,
      runId: 'r-junk',
      traceId: 'tr-junk',
      signal: new AbortController().signal,
    })

    const delAdapter = new NativeFilesystemAdapter('delete_file', { workingDirectory: testDir })
    const delTask: Task = {
      id: 't-del',
      title: 'Delete junk',
      description: 'Delete temp file',
      category: 'computation',
      requiredCapability: 'delete_file',
      toolConfig: { path: target },
      preconditions: [],
      postconditions: [],
      successConditions: ['File is deleted'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: delTask,
      blueprint: dummyBlueprint,
      runId: 'r-del',
      traceId: 'tr-del',
      signal: new AbortController().signal,
    }

    const result = await delAdapter.execute(ctx)
    expect(result.success).toBe(true)
    expect(existsSync(target)).toBe(false)

    const verification = await delAdapter.verify(ctx, result)
    expect(verification.passed).toBe(true)
  })
})
