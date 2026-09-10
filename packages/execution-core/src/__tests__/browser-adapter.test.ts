import type { AdapterContext } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import { describe, it, expect, afterAll } from 'vitest'

import { PlaywrightBrowserAdapter } from '../adapters/browser/browser-adapter'
import { PlaywrightBrowserSession } from '../adapters/browser/browser-session'

describe('PlaywrightBrowserAdapter & BrowserSession', () => {
  const session = new PlaywrightBrowserSession({ headless: true })
  const adapter = new PlaywrightBrowserAdapter('navigate_website', { session })

  afterAll(async () => {
    await adapter.dispose()
  })

  const dummyBlueprint: ExecutionBlueprint = {
    id: 'bp-browser-test',
    version: 1,
    hash: 'hash-browser-1',
    goal: {
      id: 'g-b1',
      primaryObjective: 'Browser navigation and extraction',
      constraints: [],
      requiredResources: [],
      expectedOutcome: 'done',
      confidence: 1,
      status: 'validated',
      normalizedInput: { text: 'test', originalText: 'test', detectedLanguage: 'en', entities: [], durationMs: 0 },
      createdAt: Date.now(),
    },
    intent: {
      type: 'browser',
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

  it('initializes browser session and navigates to data URL', async () => {
    await adapter.initialize()
    expect(await adapter.isAvailable()).toBe(true)

    const navTask: Task = {
      id: 'task-nav-1',
      title: 'Navigate to HTML page',
      description: 'Open data URL',
      category: 'navigation',
      requiredCapability: 'navigate_website',
      toolConfig: { url: 'data:text/html,<html><head><title>usePilot Test Page</title></head><body><h1>Welcome to usePilot</h1><div id="content">GST Invoice Total: INR 25,000</div></body></html>' },
      preconditions: [],
      postconditions: [],
      successConditions: ['Page loaded'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: navTask,
      blueprint: dummyBlueprint,
      runId: 'r-browser-1',
      traceId: 'tr-browser-1',
      signal: new AbortController().signal,
    }

    const result = await adapter.execute(ctx)
    expect(result.success).toBe(true)
    const output = result.output as { title: string; url: string }
    expect(output.title).toBe('usePilot Test Page')

    const verification = await adapter.verify(ctx, result)
    expect(verification.passed).toBe(true)
  })

  it('extracts web data from active page session', async () => {
    const extractAdapter = new PlaywrightBrowserAdapter('extract_web_data', { session })
    const extractTask: Task = {
      id: 'task-extract-1',
      title: 'Extract GST Total',
      description: 'Extract text from #content',
      category: 'computation',
      requiredCapability: 'extract_web_data',
      toolConfig: { selector: '#content' },
      preconditions: [],
      postconditions: [],
      successConditions: ['Content extracted'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
      failureStrategy: { onFailure: 'abort' },
      confidence: 1,
    }

    const ctx: AdapterContext = {
      task: extractTask,
      blueprint: dummyBlueprint,
      runId: 'r-browser-2',
      traceId: 'tr-browser-2',
      signal: new AbortController().signal,
    }

    const result = await extractAdapter.execute(ctx)
    expect(result.success).toBe(true)
    const output = result.output as { text: string }
    expect(output.text).toContain('GST Invoice Total: INR 25,000')
  })

  it('supports multiple tabs within the same browser session', async () => {
    const tab2 = await session.newTab('data:text/html,<html><head><title>Tab 2</title></head><body>Tab 2 Body</body></html>')
    expect(await tab2.title()).toBe('Tab 2')

    const activePage = await session.switchTab(0)
    expect(await activePage.title()).toBe('usePilot Test Page')
  })
})
