import { describe, it, expect } from 'vitest'
import { IntentAnalyzer } from '../intent/analyzer'
import type { AIProvider, ChatRequest, ChatResponse, StreamChunk } from '@usepilot/ai-core'
import type { Goal, PlannerContext } from '@usepilot/planner-types'

class MockIntentProvider implements AIProvider {
  id = 'mock'
  name = 'Mock'
  type = 'ollama' as const
  async listModels() { return [] }
  async testConnection() { return true }
  async *streamChat(): AsyncGenerator<StreamChunk> { yield { token: '', done: true } }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return {
      content: JSON.stringify({
        type: 'browser',
        riskLevel: 'low',
        complexity: 'medium',
        requiresHumanApproval: false,
        missingInformation: [],
        confidence: 0.9,
      }),
      model: 'test-model',
      finishReason: 'stop',
      usage: { promptTokens: 30, completionTokens: 25, totalTokens: 55 },
    }
  }
}

describe('IntentAnalyzer', () => {
  const provider = new MockIntentProvider()
  const analyzer = new IntentAnalyzer(provider)

  const goal: Goal = {
    id: 'g-1',
    conversationId: 'c-1',
    rawText: 'Download invoices',
    normalizedText: 'Download invoices',
    primaryObjective: 'Download all invoices from online portal',
    constraints: [],
    requiredResources: [],
    expectedOutcome: 'Invoices downloaded',
    confidence: 0.9,
    status: 'validated',
    createdAt: Date.now(),
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

  it('analyzes goal and produces classified Intent', async () => {
    const intent = await analyzer.analyze(goal, context, 'test-model')
    expect(intent.type).toBe('browser')
    expect(intent.riskLevel).toBe('low')
    expect(intent.confidence).toBe(0.9)
  })
})
