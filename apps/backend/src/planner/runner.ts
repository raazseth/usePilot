// ─────────────────────────────────────────────────────────────────────────────
// PlannerRunner
// Coordinates invocation of the pure core planner with provider & context.
// ─────────────────────────────────────────────────────────────────────────────

import { Planner } from '@usepilot/planner-core'
import type {
  PlannerContext,
  PlanningStage,
} from '@usepilot/planner-types'
import type { AIProvider } from '@usepilot/ai-core'

export interface RunnerOptions {
  model: string
  version?: number
  onProgress?: (stage: PlanningStage, progressPct: number, message: string) => Promise<void> | void
}

export class PlannerRunner {
  async run(
    provider: AIProvider,
    text: string,
    context: PlannerContext,
    options: RunnerOptions
  ) {
    const planner = new Planner(provider)
    return planner.plan(text, context, {
      model: options.model,
      version: options.version ?? 1,
      onProgress: options.onProgress,
    })
  }
}
