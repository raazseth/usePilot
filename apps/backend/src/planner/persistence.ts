// ─────────────────────────────────────────────────────────────────────────────
// PlannerPersistence
// Handles all database queries, run tracking, and blueprint persistence.
// ─────────────────────────────────────────────────────────────────────────────

import {
  GoalRepository,
  PlanRepository,
  PlannerRunRepository,
  SettingsRepository,
} from '@usepilot/database'
import type {
  BlueprintSummary,
  ExecutionBlueprint,
  PlanningStage,
  ValidationResult,
} from '@usepilot/planner-types'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

export class PlannerPersistence {
  readonly goalRepo: GoalRepository
  readonly planRepo: PlanRepository
  readonly runRepo: PlannerRunRepository
  readonly settingsRepo: SettingsRepository

  constructor(db: DB) {
    this.goalRepo = new GoalRepository(db)
    this.planRepo = new PlanRepository(db)
    this.runRepo = new PlannerRunRepository(db)
    this.settingsRepo = new SettingsRepository(db)
  }

  async getSettings() {
    return this.settingsRepo.get()
  }

  async createInitialGoal(conversationId: string, text: string) {
    return this.goalRepo.create({
      conversationId,
      rawText: text,
      normalizedText: text,
      primaryObjective: '',
      constraints: [],
      requiredResources: [],
      expectedOutcome: '',
      confidence: 0,
    })
  }

  async createRun(goalId: string, conversationId: string) {
    return this.runRepo.create({ goalId, conversationId })
  }

  async getRecentBlueprints(conversationId: string, limit = 5): Promise<BlueprintSummary[]> {
    const recentPlans = await this.planRepo.listByConversation(conversationId, limit)
    return recentPlans.map((p) => {
      const bp = this.planRepo.parseBlueprint(p)
      return {
        id: bp.id,
        version: bp.version,
        hash: bp.hash,
        primaryObjective: bp.goal.primaryObjective,
        taskCount: bp.tasks.length,
        estimatedComplexity: bp.estimatedComplexity,
        status: bp.status ?? ('ready' as const),
        createdAt: p.createdAt,
      }
    })
  }

  async updateRunStage(runId: string, stage: PlanningStage): Promise<void> {
    await this.runRepo.updateStage(runId, stage)
  }

  async savePlan(
    runId: string,
    goalId: string,
    conversationId: string,
    blueprint: ExecutionBlueprint,
    validation: ValidationResult,
    durationMs: number
  ) {
    const planRow = await this.planRepo.create({
      runId,
      goalId,
      conversationId,
      version: blueprint.version,
      hash: blueprint.hash,
      status: blueprint.status ?? 'ready',
      executionBlueprint: blueprint,
      validationResult: validation,
      planningDurationMs: durationMs,
    })

    await this.runRepo.markSucceeded(runId, 0, blueprint.status ?? 'ready')
    await this.goalRepo.updateStatus(goalId, 'validated')

    return planRow
  }

  async markRunFailed(runId: string, goalId: string, code: string, retries: number, stage: string): Promise<void> {
    await this.runRepo.markFailed(runId, code, retries, stage)
    await this.goalRepo.updateStatus(goalId, 'failed')
  }

  async getPlanById(planId: string) {
    return this.planRepo.findById(planId)
  }

  parseBlueprint(row: Parameters<PlanRepository['parseBlueprint']>[0]): ExecutionBlueprint {
    return this.planRepo.parseBlueprint(row)
  }
}
