// Capability Negotiation Types

import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'
import type { AdapterRegistration } from './adapter'

export interface NegotiationContext {
  task: Task
  blueprint: ExecutionBlueprint
  platform: 'windows' | 'macos' | 'linux'
  candidates: AdapterRegistration[]
  constraints?: Record<string, unknown>
}

export interface NegotiationResult {
  selected: AdapterRegistration
  candidatesEvaluated: number
  rationale: string
  fallbackCandidates: AdapterRegistration[]
}

export interface ICapabilityNegotiator {
  negotiate(ctx: NegotiationContext): Promise<NegotiationResult>
}
