// ─────────────────────────────────────────────────────────────────────────────
// MissingInformationDetector
// Identifies when a goal is missing essential, non-inferrable parameters
// (e.g. "Book a flight" without destination/dates, "Send email" without recipient).
// Prevents the planner from hallucinating missing constraints.
// ─────────────────────────────────────────────────────────────────────────────

import type { Goal, MissingInformationItem } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'

interface GoalDomainRule {
  signals: string[]
  essentialFields: Array<{
    field: string
    question: string
    reason: string
    importance: 'critical' | 'helpful' | 'optional'
    detectAbsent: (goal: Goal) => boolean
    suggestedValues?: string[]
  }>
}

const DOMAIN_RULES: GoalDomainRule[] = [
  // Travel / Booking
  {
    signals: ['flight', 'airline', 'book tickets', 'hotel', 'train', 'bus'],
    essentialFields: [
      {
        field: 'destination',
        question: 'Where would you like to travel to (destination)?',
        reason: 'A booking cannot proceed without a destination location.',
        importance: 'critical',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome} ${g.constraints.map(c => c.value).join(' ')}`.toLowerCase()
          return !/\b(to|in|at)\s+[A-Za-z]{3,}/.test(text) && !/\b(mumbai|delhi|london|paris|tokyo|new york|bangalore|san francisco)\b/.test(text)
        },
      },
      {
        field: 'date',
        question: 'What date or timeframe would you like to travel?',
        reason: 'Flight and hotel reservations require specific dates.',
        importance: 'critical',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome} ${g.constraints.map(c => c.value).join(' ')}`.toLowerCase()
          return !/\b(today|tomorrow|next week|\d{4}-\d{2}-\d{2}|\d{1,2}(st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec))\b/.test(text)
        },
      },
      {
        field: 'budget',
        question: 'Do you have a preferred budget or price limit?',
        reason: 'Prevents booking options outside user financial limits.',
        importance: 'helpful',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome} ${g.constraints.map(c => c.value).join(' ')}`.toLowerCase()
          return !/(₹|\$|€|£|\binr\b|\busd\b|\bbudget\b|\bunder\b|\bless than\b)/.test(text)
        },
      },
    ],
  },
  // Communication
  {
    signals: ['send email', 'email', 'send message', 'message', 'slack'],
    essentialFields: [
      {
        field: 'recipient',
        question: 'Who should receive this message (email address or username)?',
        reason: 'A communication action requires a specific destination address.',
        importance: 'critical',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome}`.toLowerCase()
          return !/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text) && !/\bto\s+[A-Za-z]{3,}/.test(text)
        },
      },
    ],
  },
  // Financial Transfer
  {
    signals: ['transfer money', 'pay', 'payment', 'send money', 'wire transfer'],
    essentialFields: [
      {
        field: 'amount',
        question: 'What is the exact amount to transfer?',
        reason: 'Financial transactions cannot be executed without an explicit amount.',
        importance: 'critical',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome} ${g.constraints.map(c => c.value).join(' ')}`.toLowerCase()
          return !/(₹|\$|€|£)\s?\d+|\d+\s?(rupees?|dollars?|euros?|inr|usd)/.test(text)
        },
      },
      {
        field: 'recipient_account',
        question: 'Which recipient or bank account should receive the payment?',
        reason: 'Target recipient account must be specified for security.',
        importance: 'critical',
        detectAbsent: (g) => {
          const text = `${g.primaryObjective} ${g.expectedOutcome}`.toLowerCase()
          return !/\b(to|account|beneficiary)\s+[A-Za-z0-9]{3,}/.test(text)
        },
      },
    ],
  },
]

export interface MissingInfoDetectionResult {
  hasCriticalMissingInfo: boolean
  items: MissingInformationItem[]
}

export class MissingInformationDetector {
  detect(goal: Goal): MissingInfoDetectionResult {
    const haystack = `${goal.primaryObjective} ${goal.expectedOutcome}`.toLowerCase()
    const items: MissingInformationItem[] = []

    for (const rule of DOMAIN_RULES) {
      const matchesRule = rule.signals.some((sig) => haystack.includes(sig))
      if (!matchesRule) continue

      for (const field of rule.essentialFields) {
        if (field.detectAbsent(goal)) {
          items.push({
            id: generateId(),
            field: field.field,
            question: field.question,
            reason: field.reason,
            importance: field.importance,
            suggestedValues: field.suggestedValues,
          })
        }
      }
    }

    const hasCriticalMissingInfo = items.some((item) => item.importance === 'critical')

    return {
      hasCriticalMissingInfo,
      items,
    }
  }
}
