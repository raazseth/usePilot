// ─────────────────────────────────────────────────────────────────────────────
// PlannerService
// Backend singleton that orchestrates the planning pipeline for a WebSocket
// client. Streams progress events, persists runs and blueprints, emits
// domain events to the EventBus.
//
// Isolation rule: this service never imports from chat services.
// ─────────────────────────────────────────────────────────────────────────────

import type { ServerWebSocket } from 'bun'
import { Planner, PlannerContextBuilder, PlannerErrorCode } from '@usepilot/planner-core'
import type { PlanningStage } from '@usepilot/planner-types'
import {
  GoalRepository,
  PlanRepository,
  PlannerRunRepository,
  SettingsRepository,
} from '@usepilot/database'
import type { EventBus } from '../events/bus'
import type { Logger } from '../logger'
import type { ProviderManager } from '../infrastructure/ai/provider-manager'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

export class PlannerService {
  private readonly goalRepo: GoalRepository
  private readonly planRepo: PlanRepository
  private readonly runRepo: PlannerRunRepository
  private readonly settingsRepo: SettingsRepository
  private readonly contextBuilder = new PlannerContextBuilder()

  constructor(
    private readonly db: DB,
    private readonly providerManager: ProviderManager,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {
    this.goalRepo = new GoalRepository(this.db)
    this.planRepo = new PlanRepository(this.db)
    this.runRepo = new PlannerRunRepository(this.db)
    this.settingsRepo = new SettingsRepository(this.db)
  }

  /**
   * Create a new execution blueprint for a given text input.
   * Streams progress events back through the WebSocket.
   */
  async createPlan(ws: WS, conversationId: string, text: string): Promise<void> {
    const childLogger = this.logger.child({ conversationId, action: 'createPlan' })
    childLogger.info({ text: text.slice(0, 80) }, 'Planning started')

    // ── Resolve active provider + model ──────────────────────────────────────
    const provider = this.providerManager.getActive()
    if (!provider) {
      this.sendPlanError(ws, '', 'NO_PROVIDER', 'No active AI provider configured', 0)
      return
    }

    const settings = await this.settingsRepo.get()
    const model = settings?.defaultModel ?? 'qwen2.5-coder:3b'

    // ── Persist goal ──────────────────────────────────────────────────────────
    const goalRow = await this.goalRepo.create({
      conversationId,
      rawText: text,
      normalizedText: text, // will be updated by normalizer output
      primaryObjective: '',  // will be updated after extraction
      constraints: [],
      requiredResources: [],
      expectedOutcome: '',
      confidence: 0,
    })

    // ── Create planning run ───────────────────────────────────────────────────
    const runRow = await this.runRepo.create({ goalId: goalRow.id, conversationId })

    await this.eventBus.emit('planner.started', {
      runId: runRow.id,
      goalId: goalRow.id,
      conversationId,
    })

    // ── Build context ─────────────────────────────────────────────────────────
    const recentPlans = await this.planRepo.listByConversation(conversationId, 5)
    const previousBlueprints = recentPlans.map((p) => {
      const bp = this.planRepo.parseBlueprint(p)
      return {
        id: bp.id,
        version: bp.version,
        hash: bp.hash,
        primaryObjective: bp.goal.primaryObjective,
        taskCount: bp.tasks.length,
        estimatedComplexity: bp.estimatedComplexity,
        status: 'ready' as const,
        createdAt: p.createdAt,
      }
    })

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

    // ── Progress reporter ─────────────────────────────────────────────────────
    const onProgress = async (stage: PlanningStage, progressPct: number, message: string) => {
      await this.runRepo.updateStage(runRow.id, stage)
      this.sendPlanProgress(ws, runRow.id, stage, progressPct, message)
      await this.eventBus.emit('planner.progress', {
        runId: runRow.id,
        stage,
        progressPct,
        message,
      })
    }

    // ── Run the planner ───────────────────────────────────────────────────────
    const planner = new Planner(provider)
    try {
      const result = await planner.plan(text, context, {
        model,
        version: 1,
        onProgress,
      })

      // Persist plan
      const planRow = await this.planRepo.create({
        runId: runRow.id,
        goalId: goalRow.id,
        conversationId,
        version: result.blueprint.version,
        hash: result.blueprint.hash,
        status: 'ready',
        executionBlueprint: result.blueprint,
        validationResult: result.validation,
        planningDurationMs: result.totalDurationMs,
      })

      await this.runRepo.markSucceeded(runRow.id, result.tokenCount, 'ready')
      await this.goalRepo.updateStatus(goalRow.id, 'validated')

      await this.eventBus.emit('planner.completed', {
        runId: runRow.id,
        blueprintId: planRow.id,
        taskCount: result.blueprint.tasks.length,
        estimatedComplexity: result.blueprint.estimatedComplexity,
      })

      // Send blueprint to client
      this.send(ws, {
        type: 'plan.ready',
        payload: {
          runId: runRow.id,
          blueprint: result.blueprint,
          planId: planRow.id,
          validation: result.validation,
        },
      })

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

      await this.runRepo.markFailed(runRow.id, code, retries, stage)
      await this.goalRepo.updateStatus(goalRow.id, 'failed')

      await this.eventBus.emit('planner.failed', {
        runId: runRow.id,
        errorCode: code,
        stage,
        retries,
        message,
      })

      this.sendPlanError(ws, runRow.id, code, message, retries)
      childLogger.error({ err, runId: runRow.id }, 'Planning failed')
    }
  }

  async getPlan(ws: WS, planId: string): Promise<void> {
    const row = await this.planRepo.findById(planId)
    if (!row) {
      this.send(ws, { type: 'error', payload: { code: 'NOT_FOUND', message: `Plan ${planId} not found` } })
      return
    }
    this.send(ws, {
      type: 'plan.ready',
      payload: {
        runId: row.runId,
        blueprint: this.planRepo.parseBlueprint(row),
        planId: row.id,
      },
    })
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  private send(ws: WS, data: unknown): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(data))
    }
  }

  private sendPlanProgress(
    ws: WS,
    runId: string,
    stage: PlanningStage,
    progressPct: number,
    message: string
  ): void {
    this.send(ws, {
      type: 'plan.progress',
      payload: { runId, stage, progressPct, message },
    })
  }

  private sendPlanError(
    ws: WS,
    runId: string,
    code: string,
    message: string,
    retries: number
  ): void {
    this.send(ws, {
      type: 'plan.error',
      payload: { runId, code, message, retries },
    })
  }
}
