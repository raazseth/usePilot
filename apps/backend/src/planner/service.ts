// PlannerService

import type { ServerWebSocket } from 'bun'
import { PlannerContextBuilder } from '@usepilot/planner-core'
import type { PlanningStage } from '@usepilot/planner-types'
import type { EventBus } from '../events/bus'
import type { Logger } from '../logger'
import type { ProviderManager } from '../infrastructure/ai/provider-manager'
import { PlannerPersistence } from './persistence'
import { PlannerEvents } from './events'
import { PlannerRunner } from './runner'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

export class PlannerService {
  private readonly persistence: PlannerPersistence
  private readonly events: PlannerEvents
  private readonly runner: PlannerRunner
  private readonly contextBuilder = new PlannerContextBuilder()

  constructor(
    db: DB,
    private readonly providerManager: ProviderManager,
    eventBus: EventBus,
    private readonly logger: Logger
  ) {
    this.persistence = new PlannerPersistence(db)
    this.events = new PlannerEvents(eventBus)
    this.runner = new PlannerRunner()
  }

  /**
   * Create a new execution blueprint for a given text input.
   * Streams progress events back through the WebSocket.
   */
  async createPlan(ws: WS, conversationId: string, text: string): Promise<void> {
    const childLogger = this.logger.child({ conversationId, action: 'createPlan' })
    childLogger.info({ text: text.slice(0, 80) }, 'Planning started')

    // Resolve active provider + model
    const provider = this.providerManager.getActive()
    if (!provider) {
      this.events.send(ws, {
        type: 'plan.error',
        payload: { runId: '', code: 'NO_PROVIDER', message: 'No active AI provider configured', retries: 0 },
      })
      return
    }

    const settings = await this.persistence.getSettings()
    const model = settings?.defaultModel ?? 'qwen2.5-coder:3b'

    // Persist goal & run
    const goalRow = await this.persistence.createInitialGoal(conversationId, text)
    const runRow = await this.persistence.createRun(goalRow.id, conversationId)

    await this.events.emitStarted(runRow.id, goalRow.id, conversationId)

    // Build context
    const previousBlueprints = await this.persistence.getRecentBlueprints(conversationId, 5)

    const context = this.contextBuilder.build({
      conversationId,
      conversationHistory: [],
      settings: {
        activeProviderType: settings?.activeProviderType ?? undefined,
        defaultModel: settings?.defaultModel ?? undefined,
        temperature: settings?.temperature,
        featureFlags: settings?.featureFlags ? JSON.parse(settings.featureFlags) : {},
      },
      previousBlueprints,
    })

    // Progress reporter callback
    const onProgress = async (stage: PlanningStage, progressPct: number, message: string) => {
      await this.persistence.updateRunStage(runRow.id, stage)
      await this.events.sendAndEmitProgress(ws, runRow.id, stage, progressPct, message)
    }

    // Execute planning pipeline
    try {
      const result = await this.runner.run(provider, text, context, {
        model,
        version: 1,
        onProgress,
      })

      // Persist plan
      const planRow = await this.persistence.savePlan(
        runRow.id,
        goalRow.id,
        conversationId,
        result.blueprint,
        result.validation,
        result.totalDurationMs
      )

      await this.events.sendAndEmitCompleted(
        ws,
        runRow.id,
        planRow.id,
        result.blueprint,
        result.validation
      )

      childLogger.info(
        { planId: planRow.id, taskCount: result.blueprint.tasks.length, durationMs: result.totalDurationMs },
        'Planning completed'
      )
    } catch (err) {
      const code = err instanceof Error && 'code' in err
        ? (err as { code: string }).code
        : 'UNKNOWN'
      const stage = err instanceof Error && 'stage' in err
        ? (err as { stage: string }).stage
        : 'unknown'
      const retries = err instanceof Error && 'retries' in err
        ? (err as { retries: number }).retries
        : 0
      const message = err instanceof Error ? err.message : String(err)

      await this.persistence.markRunFailed(runRow.id, goalRow.id, code, retries, stage)
      await this.events.sendAndEmitFailed(ws, runRow.id, code, stage, retries, message)

      childLogger.error({ err, runId: runRow.id }, 'Planning failed')
    }
  }

  async getPlan(ws: WS, planId: string): Promise<void> {
    const row = await this.persistence.getPlanById(planId)
    if (!row) {
      this.events.send(ws, { type: 'error', payload: { code: 'NOT_FOUND', message: `Plan ${planId} not found` } })
      return
    }
    this.events.send(ws, {
      type: 'plan.ready',
      payload: {
        runId: row.runId,
        blueprint: this.persistence.parseBlueprint(row),
        planId: row.id,
      },
    })
  }
}
