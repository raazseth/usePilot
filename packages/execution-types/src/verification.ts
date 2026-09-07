// Verification Types

import type { SuccessCriteria } from '@usepilot/planner-types'

export type VerificationLevel = 'strict' | 'standard' | 'best_effort'

export interface VerificationResult {
  passed: boolean
  level?: VerificationLevel | undefined
  checkedConditions: string[]
  failedConditions: string[]
  warnings?: string[] | undefined
  strategy: SuccessCriteria['verificationStrategy']
  notes?: string | undefined
  durationMs: number
}
