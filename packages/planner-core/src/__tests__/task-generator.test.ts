import { describe, it, expect } from 'vitest'
import { TaskGenerator } from '../tasks/generator'
import type { AIProvider, ChatRequest, ChatResponse, StreamChunk } from '@usepilot/ai-core'
import type { Goal, Intent, PlannerContext } from '@usepilot/planner-types'

class MockTaskProvider implements AIProvider {
  id = 'mock'
  name = 'Mock'
  type = 'ollama' as const
  async listModels() { return [] }
  async testConnection() { return true }
  async healthCheck() { return { status: 'online' as const, latencyMs: 0 } }
  async *streamChat(): AsyncGenerator<StreamChunk> { yield { token: '', done: true } }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return {
      content: JSON.stringify({
        tasks: [
          {
            title: 'Navigate to target dashboard',
            description: 'Open browser and load dashboard',
            category: 'navigation',
            requiredTool: 'browser',
            preconditions: ['Browser open'],
            postconditions: ['Dashboard loaded'],
            successConditions: ['Dashboard loaded successfully'],
            failureConditions: ['Timeout'],
            dependsOn: [],
            complexity: 'low',
          },
          {
            title: 'Extract invoice records',
            description: 'Save invoice records to CSV file',
            category: 'extraction',
            requiredTool: 'filesystem',
            preconditions: ['Dashboard loaded'],
            postconditions: ['CSV created'],
            successConditions: ['CSV file exists'],
            failureConditions: ['File write failed'],
            dependsOn: ['task_0'],
            complexity: 'medium',
          },
        ],
      }),
      model: 'test-model',
      finishReason: 'stop',
      usage: { promptTokens: 50, completionTokens: 80, totalTokens: 130 },
    }
  }
}

describe('TaskGenerator', () => {
  const provider = new MockTaskProvider()
  const generator = new TaskGenerator(provider)

  const goal: Goal = {
    id: 'g-1',
    primaryObjective: 'Download all invoice records to CSV',
    constraints: [],
    rawConstraints: [],
    requiredResources: [],
    expectedOutcome: 'CSV generated',
    confidence: 0.9,
    normalizedInput: {
      text: 'Download records',
      originalText: 'Download records',
      detectedLanguage: 'en',
      entities: [],
      durationMs: 1,
    },
    status: 'validated',
    createdAt: Date.now(),
  }

  const intent: Intent = {
    type: 'browser',
    riskLevel: 'low',
    complexity: 'medium',
    requiresHumanApproval: false,
    missingInformation: [],
    confidence: 0.9,
    durationMs: 10,
  }

  const context: PlannerContext = {
    conversationId: 'c-1',
    conversationHistory: [],
    settings: {
      activeProviderType: 'ollama',
      defaultModel: 'test-model',
      temperature: 0.2,
      featureFlags: {},
    },
    availableTools: ['browser', 'filesystem'],
    platform: 'windows',
    previousBlueprints: [],
  }

  it('generates atomic tasks and resolves stable dependency IDs', async () => {
    const tasks = await generator.generate(goal, intent, context, 'test-model')
    expect(tasks).toHaveLength(2)
    expect(tasks[0]?.requiredTool).toBe('browser')
    expect(tasks[1]?.requiredTool).toBe('filesystem')
    // task_0 should be resolved to tasks[0].id
    expect(tasks[1]?.dependsOn).toContain(tasks[0]?.id)
  })
})
