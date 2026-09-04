import { describe, it, expect } from 'vitest'
import { Planner } from '../planner'
import type { AIProvider, ChatRequest, ChatResponse, StreamChunk } from '@usepilot/ai-core'
import type { PlannerContext } from '@usepilot/planner-types'

class MockAIProvider implements AIProvider {
  id = 'mock'
  name = 'MockProvider'
  type = 'ollama' as const

  async listModels() {
    return [{ id: 'mock-model', name: 'Mock Model' }]
  }

  async testConnection() {
    return true
  }

  async *streamChat(): AsyncGenerator<StreamChunk> {
    yield { token: '', done: true }
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const userMsg = request.messages[request.messages.length - 1]?.content ?? ''

    // 1. GoalExtractor response
    if (userMsg.includes('Extract the goal from this input')) {
      return {
        content: JSON.stringify({
          primaryObjective: 'Download all invoices from Amazon Business portal',
          constraints: ['Organize files by invoice month'],
          requiredResources: ['Amazon Business portal credentials'],
          expectedOutcome: 'All monthly invoices saved to disk as PDF documents',
          confidence: 0.95,
        }),
        model: 'mock-model',
        finishReason: 'stop',
        usage: { promptTokens: 50, completionTokens: 40, totalTokens: 90 },
      }
    }

    // 2. IntentAnalyzer response
    if (userMsg.includes('Analyze this goal')) {
      return {
        content: JSON.stringify({
          type: 'browser',
          riskLevel: 'low',
          complexity: 'medium',
          requiresHumanApproval: false,
          missingInformation: [],
          confidence: 0.92,
        }),
        model: 'mock-model',
        finishReason: 'stop',
        usage: { promptTokens: 60, completionTokens: 35, totalTokens: 95 },
      }
    }

    // 3. TaskGenerator response
    if (userMsg.includes('Generate tasks for this goal')) {
      return {
        content: JSON.stringify({
          tasks: [
            {
              title: 'Navigate to Amazon portal',
              description: 'Open browser and go to billing portal',
              category: 'navigation',
              requiredTool: 'browser',
              preconditions: ['Browser installed and ready'],
              postconditions: ['Amazon billing portal is visible'],
              successConditions: ['Portal dashboard is loaded'],
              failureConditions: ['Network connection error'],
              dependsOn: [],
              complexity: 'low',
            },
            {
              title: 'Download monthly invoice PDF',
              description: 'Download the current invoice statement',
              category: 'extraction',
              requiredTool: 'browser',
              preconditions: ['Amazon billing portal is visible'],
              postconditions: ['Invoice PDF saved to downloads folder'],
              successConditions: ['Invoice PDF file downloaded successfully'],
              failureConditions: ['Download button not clickable'],
              dependsOn: ['task_0'],
              complexity: 'medium',
            },
          ],
        }),
        model: 'mock-model',
        finishReason: 'stop',
        usage: { promptTokens: 100, completionTokens: 120, totalTokens: 220 },
      }
    }

    return {
      content: '{}',
      model: 'mock-model',
      finishReason: 'stop',
      usage: { promptTokens: 10, completionTokens: 10, totalTokens: 20 },
    }
  }
}

describe('Planner Full Integration Pipeline', () => {
  const provider = new MockAIProvider()
  const planner = new Planner(provider)

  const context: PlannerContext = {
    conversationId: 'conv-integration-1',
    conversationHistory: [],
    settings: {
      activeProviderType: 'ollama',
      defaultModel: 'mock-model',
      temperature: 0.2,
      featureFlags: {},
    },
    availableTools: ['browser', 'filesystem', 'email', 'terminal', 'api', 'clipboard', 'none'],
    platform: 'windows',
    previousBlueprints: [],
  }

  it('transforms natural language input into a validated, optimized ExecutionBlueprint', async () => {
    const stagesVisited: string[] = []

    const result = await planner.plan(
      'Download all invoices from Amazon Business and organize them by month',
      context,
      {
        model: 'mock-model',
        version: 1,
        onProgress: (stage) => {
          stagesVisited.push(stage)
        },
      }
    )

    // Pipeline verification
    expect(result.blueprint).toBeDefined()
    expect(result.blueprint.id).toBeTruthy()
    expect(result.blueprint.hash).toMatch(/^[a-f0-9]{64}$/)
    expect(result.blueprint.version).toBe(1)

    // Tasks & DAG verification
    expect(result.blueprint.tasks.length).toBeGreaterThan(0)
    expect(result.blueprint.graph.nodes.length).toBe(result.blueprint.tasks.length)

    // Three-layer validation
    expect(result.validation.valid).toBe(true)
    expect(result.validation.schema.passed).toBe(true)
    expect(result.validation.semantic.passed).toBe(true)
    expect(result.validation.execution.passed).toBe(true)

    // Stages progression
    expect(stagesVisited).toContain('normalizing')
    expect(stagesVisited).toContain('extracting')
    expect(stagesVisited).toContain('validating_goal')
    expect(stagesVisited).toContain('analyzing')
    expect(stagesVisited).toContain('generating')
    expect(stagesVisited).toContain('building')
    expect(stagesVisited).toContain('validating')
    expect(stagesVisited).toContain('optimizing')
    expect(stagesVisited).toContain('serializing')
  })
})
