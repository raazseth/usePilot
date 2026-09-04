import { describe, it, expect } from 'vitest'
import { GoalValidator } from '../goal/validator'
import type { Goal } from '@usepilot/planner-types'

describe('GoalValidator', () => {
  const validator = new GoalValidator()

  const validGoal: Goal = {
    id: 'goal-1',
    primaryObjective: 'Download all 2024 invoices from Amazon account',
    constraints: [{ id: 'c-1', key: 'temporal', value: 'Filter by year 2024', type: 'temporal', isHardConstraint: true }],
    rawConstraints: ['Filter by year 2024'],
    requiredResources: ['Amazon login credentials'],
    expectedOutcome: 'PDF invoices saved in Downloads directory',
    confidence: 0.95,
    normalizedInput: {
      text: 'Download all invoices from Amazon',
      originalText: 'Download all invoices from Amazon',
      detectedLanguage: 'en',
      entities: [],
      durationMs: 1,
    },
    status: 'validated',
    createdAt: Date.now(),
  }

  it('passes a well-formed goal', () => {
    const result = validator.validate(validGoal)
    expect(result.valid).toBe(true)
    expect(result.issues).toHaveLength(0)
  })

  it('flags goals with short primaryObjective', () => {
    const result = validator.validate({
      ...validGoal,
      primaryObjective: 'Do it',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes('primaryObjective is too short'))).toBe(true)
  })

  it('flags goals containing vague words', () => {
    const result = validator.validate({
      ...validGoal,
      primaryObjective: 'Download some stuff from my online accounts',
    })
    expect(result.valid).toBe(false)
    expect(result.issues.some((i) => i.includes('vague language'))).toBe(true)
  })
})
