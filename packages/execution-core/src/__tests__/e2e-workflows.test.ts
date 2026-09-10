import { existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { ExecutionBlueprint, Task, TaskGraph } from '@usepilot/planner-types'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  createProductionRegistry,
  createExecutionRunner,
} from '../index'


function makeTestBlueprint(id: string, tasks: Task[]): ExecutionBlueprint {
  const nodes = tasks.map((t, i) => ({
    taskId: t.id,
    layer: i,
    isCritical: true,
    canParallelize: false,
    inDegree: i === 0 ? 0 : 1,
    outDegree: i === tasks.length - 1 ? 0 : 1,
  }))

  const graph: TaskGraph = {
    nodes,
    edges: tasks.slice(1).map((t, i) => ({
      from: tasks[i]!.id,
      to: t.id,
      type: 'depends_on' as const,
    })),
    parallelGroups: tasks.map((t) => [t.id]),
    criticalPath: tasks.map((t) => t.id),
    taskCount: tasks.length,
    depth: tasks.length,
  }

  return {
    id,
    version: 1,
    hash: `sha256-${id}`,
    goal: {
      id: 'g-e2e',
      primaryObjective: 'E2E Workflow Test',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'completed',
      confidence: 1,
      status: 'validated',
      normalizedInput: {
        text: 'E2E test',
        originalText: 'E2E test',
        detectedLanguage: 'en',
        entities: [],
        durationMs: 0,
      },
      createdAt: Date.now(),
    },
    intent: {
      type: 'mixed',
      complexity: 'low',
      riskLevel: 'low',
      requiresHumanApproval: false,
      missingInformation: [],
      confidence: 1,
      durationMs: 5,
    },
    tasks,
    graph,
    approvals: {
      requiresMandatoryApproval: false,
      hasForbiddenTasks: false,
      mandatoryTaskIds: [],
      optionalTaskIds: [],
      forbiddenTaskIds: [],
    },
    successCriteria: [],
    estimatedComplexity: 'low',
    optimization: {
      mergedTasks: [],
      removedDuplicates: [],
      newParallelGroups: [],
      simplifications: [],
      changed: false,
    },
    plannerContext: {
      platform: 'windows',
      availableTools: [],
      settingsSnapshot: {},
      previousBlueprintCount: 0,
    },
    createdAt: Date.now(),
  }
}

describe('End-to-End Capability Workflows', () => {
  const testDir = join(tmpdir(), `usepilot-e2e-${Date.now()}`)

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

  it('executes "Organize Downloads" workflow with real filesystem operations', async () => {
    const rawInvoicePath = join(testDir, 'raw', 'amazon-invoice-sep-2026.pdf')
    const finalMonthlyDir = join(testDir, 'organized', '2026-09')
    const finalInvoicePath = join(finalMonthlyDir, 'amazon-invoice-sep-2026.pdf')

    const task1: Task = {
      id: 'task-download-invoice',
      title: 'Save Amazon GST invoice to downloads',
      description: 'Simulate saving invoice',
      category: 'computation',
      requiredCapability: 'write_file',
      toolConfig: { path: rawInvoicePath, content: '%PDF-1.4 Amazon GST Invoice ₹4,250' },
      preconditions: [],
      postconditions: [],
      successConditions: ['Invoice saved on disk'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const task2: Task = {
      id: 'task-organize-monthly',
      title: 'Move invoice into monthly folder',
      description: 'Organize into 2026-09',
      category: 'computation',
      requiredCapability: 'move_file',
      toolConfig: { source: rawInvoicePath, destination: finalInvoicePath },
      preconditions: [],
      postconditions: [],
      successConditions: ['File exists in monthly folder'],
      failureConditions: [],
      dependsOn: ['task-download-invoice'],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const blueprint = makeTestBlueprint('bp-organize-downloads', [task1, task2])
    const registry = createProductionRegistry()
    const { runner } = createExecutionRunner('run-org-e2e', 'tr-org-e2e', registry)

    const result = await runner.run('run-org-e2e', 'tr-org-e2e', blueprint)

    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(2)
    expect(result.tasksFailed).toBe(0)

    // Verify files on disk
    expect(existsSync(rawInvoicePath)).toBe(false)
    expect(existsSync(finalInvoicePath)).toBe(true)
    expect(readFileSync(finalInvoicePath, 'utf8')).toContain('Amazon GST Invoice')

    // Verify cryptographic manifest
    expect(result.manifest).toBeDefined()
    expect(result.manifest?.outcome).toBe('success')
    expect(result.manifest?.manifestHash).toBeDefined()
  })

  it('executes mixed Desktop & Filesystem workflow seamlessly', async () => {
    const clipboardText = `GST-INVOICE-HASH-VERIFIED-${Date.now()}`
    const auditFilePath = join(testDir, 'audit-log.txt')

    const task1: Task = {
      id: 'task-clip',
      title: 'Copy invoice verification token to clipboard',
      description: 'Copy token',
      category: 'computation',
      requiredCapability: 'write_clipboard',
      toolConfig: { text: clipboardText },
      preconditions: [],
      postconditions: [],
      successConditions: ['Clipboard copied'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const task2: Task = {
      id: 'task-log',
      title: 'Write audit log to filesystem',
      description: 'Write log file',
      category: 'computation',
      requiredCapability: 'write_file',
      toolConfig: { path: auditFilePath, content: `Logged token: ${clipboardText}` },
      preconditions: [],
      postconditions: [],
      successConditions: ['Log file exists'],
      failureConditions: [],
      dependsOn: ['task-clip'],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const blueprint = makeTestBlueprint('bp-mixed-e2e', [task1, task2])
    const registry = createProductionRegistry()
    const { runner } = createExecutionRunner('run-mixed-e2e', 'tr-mixed-e2e', registry)

    const result = await runner.run('run-mixed-e2e', 'tr-mixed-e2e', blueprint)

    expect(result.status).toBe('completed')
    expect(existsSync(auditFilePath)).toBe(true)
    expect(readFileSync(auditFilePath, 'utf8')).toContain(clipboardText)
  })
})
