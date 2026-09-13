import type { ServerWebSocket } from 'bun'
import {
  SkillRegistry,
  SkillDiscovery,
  SkillResolver,
  SkillWorkflowCompiler,
  SkillVerifier,
  SkillTelemetryCollector,
  BUILTIN_SKILLS,
} from '@usepilot/skill-core'
import type {
  SkillManifest,
  SkillCandidate,
  SkillResolution,
  SkillDiscoveryQuery,
  SkillCategory,
} from '@usepilot/skill-types'
import type { ExecutionResult } from '@usepilot/execution-types'
import type { EventBus } from '../events/bus'
import type { Logger } from '../logger'
import type { PlannerService } from '../planner/service'
import type { ExecutionService } from '../execution/service'
import { PlanRepository } from '@usepilot/database'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

/**
 * SkillService — Backend coordinator for Skill discovery, resolution, compilation, and execution.
 */
export class SkillService {
  readonly registry = new SkillRegistry()
  readonly discovery: SkillDiscovery
  readonly resolver = new SkillResolver()
  readonly compiler = new SkillWorkflowCompiler()
  readonly verifier = new SkillVerifier()
  readonly telemetry = new SkillTelemetryCollector()
  private readonly planRepo: PlanRepository

  constructor(
    private readonly db: DB,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
    private readonly plannerService?: PlannerService,
    private readonly executionService?: ExecutionService
  ) {
    this.planRepo = new PlanRepository(this.db)

    // Register initial built-in production skills
    for (const skill of BUILTIN_SKILLS) {
      try {
        this.registry.register(skill)
      } catch (err) {
        this.logger.error({ err, skillId: skill.id }, 'Failed to register built-in skill')
      }
    }

    this.discovery = new SkillDiscovery(this.registry)
    this.logger.info({ skillCount: this.registry.list().length }, 'SkillService initialized with built-in skills')
  }

  /**
   * List all registered Skill manifests.
   */
  listSkills(category?: SkillCategory): SkillManifest[] {
    return this.registry.listManifests(category)
  }

  /**
   * Discover matching candidate Skills for a query or user prompt.
   */
  discover(query: SkillDiscoveryQuery): SkillCandidate[] {
    return this.discovery.discover(query)
  }

  /**
   * Resolve a Skill with given inputs.
   */
  resolve(skillId: string, inputs: Record<string, unknown>): SkillResolution {
    const skill = this.registry.get(skillId)
    if (!skill) {
      throw new Error(`Skill "${skillId}" is not registered.`)
    }
    return this.resolver.resolve(skill, inputs)
  }

  /**
   * Execute a configured Skill end-to-end.
   */
  async executeSkill(
    ws: WS,
    conversationId: string,
    skillId: string,
    inputs: Record<string, unknown>
  ): Promise<void> {
    const skill = this.registry.get(skillId)
    if (!skill) {
      ws.send(JSON.stringify({
        type: 'skill.error',
        payload: { error: `Skill "${skillId}" not found` },
      }))
      return
    }

    const resolution = this.resolver.resolve(skill, inputs)
    if (!resolution.success) {
      ws.send(JSON.stringify({
        type: 'skill.resolve.required',
        payload: {
          skillId,
          status: resolution.status,
          missingInputs: resolution.missingInputs,
          invalidInputs: resolution.invalidInputs,
          promptQuestion: resolution.userPromptRequired,
        },
      }))
      return
    }

    // Compile into Workflow & ExecutionBlueprint via existing Planner pipeline
    const { workflow, blueprint } = await this.compiler.compile(
      skill,
      resolution.configuredInputs,
      { conversationId }
    )

    ws.send(JSON.stringify({
      type: 'skill.compiled',
      payload: {
        skillId: skill.id,
        skillVersion: skill.version,
        workflowId: workflow.id,
        blueprintId: blueprint.id,
        taskCount: blueprint.tasks.length,
        requiresApproval: blueprint.approvals.requiresMandatoryApproval,
      },
    }))

    // Persist plan in database
    await this.planRepo.create({
      runId: blueprint.id,
      goalId: blueprint.goal.id,
      conversationId,
      version: 1,
      hash: blueprint.hash,
      status: 'ready',
      executionBlueprint: blueprint,
    })

    // If execution service is available, run blueprint
    if (this.executionService) {
      ws.send(JSON.stringify({
        type: 'skill.executing',
        payload: {
          skillId: skill.id,
          workflowId: workflow.id,
          blueprintId: blueprint.id,
        },
      }))

      // Delegate directly to ExecutionService
      await this.executionService.startExecution(ws, blueprint.id)
    }
  }

  /**
   * Verify post-execution outcome of a skill execution.
   */
  verifyOutcome(
    skillId: string,
    inputs: Record<string, unknown>,
    executionResult: ExecutionResult
  ) {
    const skill = this.registry.get(skillId)
    if (!skill) return { verified: false, error: 'Skill not found' }
    return this.verifier.verify(skill, inputs, executionResult)
  }
}
