import type { AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe, it, expect } from 'vitest'

import { NativeDesktopAdapter } from '../adapters/desktop/desktop-adapter'

describe('NativeDesktopAdapter', () => {
  const dummyBlueprint: ExecutionBlueprint = {
    id: 'bp-desktop-1',
    version: 1,
    hash: 'hash-desktop-1',
    goal: {
      id: 'g-desk',
      primaryObjective: 'Desktop test',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'done',
      confidence: 1,
      status: 'validated',
      normalizedInput: { text: 'test', originalText: 'test', detectedLanguage: 'en', entities: [], durationMs: 0 },
      createdAt: Date.now(),
    },
    intent: {
      type: 'desktop',
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

  it('writes and reads clipboard text and verifies output', async () => {
    const writeAdapter = new NativeDesktopAdapter('write_clipboard')
    const testText = `UsePilot Test Clipboard ${Date.now()}`

    const writeTask: Task = {
      id: 't-clip-w',
      title: 'Write clipboard',
      description: 'Write string to clipboard',
      category: 'computation',
      requiredCapability: 'write_clipboard',
      toolConfig: { text: testText },
      preconditions: [],
      postconditions: [],
      successConditions: ['Clipboard text matches expected'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: writeTask,
      blueprint: dummyBlueprint,
      runId: 'r-clip-1',
      traceId: 'tr-clip-1',
      signal: new AbortController().signal,
    }

    const writeResult = await writeAdapter.execute(ctx)
    expect(writeResult.success).toBe(true)

    const verification = await writeAdapter.verify(ctx, writeResult)
    expect(verification.passed).toBe(true)

    const readAdapter = new NativeDesktopAdapter('read_clipboard')
    const readResult = await readAdapter.execute({
      ...ctx,
      task: {
        ...writeTask,
        id: 't-clip-r',
        requiredCapability: 'read_clipboard',
      },
    })
    expect(readResult.success).toBe(true)
    const output = readResult.output as { content: string }
    expect(output.content.includes(testText)).toBe(true)
  })

  it('executes shell commands and captures output', async () => {
    const cmdAdapter = new NativeDesktopAdapter('execute_command')
    const task: Task = {
      id: 't-cmd',
      title: 'Echo test',
      description: 'Run echo command',
      category: 'computation',
      requiredCapability: 'execute_command',
      toolConfig: { command: 'node -e "console.log(\'usepilot-command-ok\')"' },
      preconditions: [],
      postconditions: [],
      successConditions: ['Exit code 0'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task,
      blueprint: dummyBlueprint,
      runId: 'r-cmd',
      traceId: 'tr-cmd',
      signal: new AbortController().signal,
    }

    const result = await cmdAdapter.execute(ctx)
    expect(result.success).toBe(true)
    const output = result.output as { stdout: string; exitCode: number }
    expect(output.stdout).toContain('usepilot-command-ok')
    expect(output.exitCode).toBe(0)
  })
})
