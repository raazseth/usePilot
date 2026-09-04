import { describe, it, expect } from 'vitest'
import { MissingInformationDetector } from '../goal/missing-info-detector'
import type { Goal } from '@usepilot/planner-types'

function makeTestGoal(primaryObjective: string, expectedOutcome: string): Goal {
  return {
    id: 'g-test',
    primaryObjective,
    expectedOutcome,
    constraints: [],
    rawConstraints: [],
    requiredResources: [],
    confidence: 0.9,
    normalizedInput: {
      text: primaryObjective,
      originalText: primaryObjective,
      detectedLanguage: 'en',
      entities: [],
      durationMs: 1,
    },
    status: 'validated',
    createdAt: Date.now(),
  }
}

describe('MissingInformationDetector', () => {
  const detector = new MissingInformationDetector()

  it('detects missing destination and dates for travel bookings', () => {
    const goal = makeTestGoal('Book a flight', 'Ticket booked')

    const result = detector.detect(goal)
    expect(result.hasCriticalMissingInfo).toBe(true)
    const fields = result.items.map((i) => i.field)
    expect(fields).toContain('destination')
    expect(fields).toContain('date')
  })

  it('passes when flight destination and date are specified', () => {
    const goal = makeTestGoal('Book a flight to Tokyo tomorrow', 'Ticket booked to Tokyo')

    const result = detector.detect(goal)
    const critical = result.items.filter((i) => i.importance === 'critical')
    expect(critical.length).toBe(0)
  })

  it('detects missing recipient for email communications', () => {
    const goal = makeTestGoal('Send an email with the quarterly updates', 'Email delivered')

    const result = detector.detect(goal)
    expect(result.hasCriticalMissingInfo).toBe(true)
    expect(result.items.some((i) => i.field === 'recipient')).toBe(true)
  })

  it('detects missing amount for financial transfers', () => {
    const goal = makeTestGoal('Transfer money to account 12345', 'Money sent')

    const result = detector.detect(goal)
    expect(result.hasCriticalMissingInfo).toBe(true)
    expect(result.items.some((i) => i.field === 'amount')).toBe(true)
  })
})
