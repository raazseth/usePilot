import { describe, it, expect } from 'vitest'
import { GoalExtractor } from '../goal/extractor'
import type { AIProvider, ChatRequest, ChatResponse, StreamChunk } from '@usepilot/ai-core'
import type { NormalizedInput } from '@usepilot/planner-types'

class MockExtractionProvider implements AIProvider {
  id = 'mock'
  name = 'Mock'
  type = 'ollama' as const
  async listModels() { return [] }
  async testConnection() { return true }
  async *streamChat(): AsyncGenerator<StreamChunk> { yield { token: '', done: true } }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    return {
      content: JSON.stringify({
        primaryObjective: 'Download all invoice statements from portal',
        constraints: ['Only PDF format'],
        requiredResources: ['Portal login'],
        expectedOutcome: 'Invoices downloaded to disk',
        confidence: 0.95,
      }),
      model: 'test-model',
      finishReason: 'stop',
      usage: { promptTokens: 20, completionTokens: 20, totalTokens: 40 },
    }
  }
}

describe('GoalExtractor', () => {
  const provider = new MockExtractionProvider()
  const extractor = new GoalExtractor(provider)

  const normalized: NormalizedInput = {
    text: 'Download all invoices from portal',
    originalText: 'Download all invoices from portal',
    detectedLanguage: 'en',
    entities: [],
    durationMs: 1,
  }

  it('extracts and parses structured Goal from LLM JSON response', async () => {
    const goal = await extractor.extract(normalized, 'test-model')
    expect(goal).toBeDefined()
    expect(goal.primaryObjective).toBe('Download all invoice statements from portal')
    expect(goal.constraints).toContain('Only PDF format')
    expect(goal.confidence).toBe(0.95)
  })
})
