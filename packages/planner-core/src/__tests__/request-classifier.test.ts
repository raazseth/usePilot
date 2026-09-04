import { describe, it, expect } from 'vitest'
import { RequestClassifier } from '../classifier/request-classifier'

describe('RequestClassifier', () => {
  const classifier = new RequestClassifier(null)

  it('classifies task-oriented requests as planning', async () => {
    const inputs = [
      'Download all invoices from Amazon',
      'Organize my downloads folder by month',
      'Automate invoice extraction from portal',
      'Schedule a backup of my workspace',
    ]

    for (const input of inputs) {
      const result = await classifier.classify(input, 'test-model')
      expect(result.type).toBe('planning')
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('classifies informational queries as conversation', async () => {
    const inputs = [
      'What is Docker and how does it work?',
      'Explain the difference between SQLite and PostgreSQL',
      'Summarize the key architectural patterns of DDD',
      'Can you help me understand monorepos?',
    ]

    for (const input of inputs) {
      const result = await classifier.classify(input, 'test-model')
      expect(result.type).toBe('conversation')
      expect(result.confidence).toBeGreaterThanOrEqual(0.5)
    }
  })

  it('classifies execution commands as execution', async () => {
    const inputs = [
      'Execute plan #3',
      'Cancel execution right now',
      'Run blueprint for invoice processing',
    ]

    for (const input of inputs) {
      const result = await classifier.classify(input, 'test-model')
      expect(result.type).toBe('execution')
    }
  })
})
