import { z } from 'zod'

export type EvaluationSource =
  | 'DEV'
  | 'HOLDOUT'
  | 'REAL_WORLD'
  | 'FAILURE'
  | 'REGRESSION'
  | 'ADVERSARIAL'

export const EvaluationSourceSchema = z.enum([
  'DEV',
  'HOLDOUT',
  'REAL_WORLD',
  'FAILURE',
  'REGRESSION',
  'ADVERSARIAL',
])

export interface EvaluationCase {
  id: string
  name: string
  description?: string | undefined
  source: EvaluationSource
  input: string
  expectedIntent: string
  expectedOutcome: string
  expectedSkills: string[]
  expectedWorkflow?: string | undefined
  expectedRisk: string
  expectedClarification: boolean
  actualDecision?: string | undefined
  actualOutcome?: string | undefined
  evaluationStatus: 'PENDING' | 'PASSED' | 'FAILED' | 'SKIPPED'
  failureReason?: string | undefined
  createdAt: number
}

export interface EvaluationReport {
  suiteName: string
  totalCases: number
  correct: number
  incorrect: number
  unsafe: number
  clarificationCorrect: number
  clarificationIncorrect: number
  falsePositive: number
  falseNegative: number
  accuracy: number
  timestamp: number
  cases: EvaluationCase[]
}
