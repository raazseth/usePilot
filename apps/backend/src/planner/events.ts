// ─────────────────────────────────────────────────────────────────────────────
// PlannerEvents
// Responsible for WebSocket message formatting and EventBus emissions.
// ─────────────────────────────────────────────────────────────────────────────

import type { ServerWebSocket } from 'bun'
import type { PlanningStage, ExecutionBlueprint, ValidationResult } from '@usepilot/planner-types'
import type { EventBus } from '../events/bus'

interface WSData {
  requestId: string
}

type WS = ServerWebSocket<WSData>

export class PlannerEvents {
  constructor(private readonly eventBus: EventBus) {}

  send(ws: WS, data: unknown): void {
    if (ws.readyState === 1 /* OPEN */) {
      ws.send(JSON.stringify(data))
    }
  }

  async emitStarted(runId: string, goalId: string, conversationId: string): Promise<void> {
    await this.eventBus.emit('planner.started', {
      runId,
      goalId,
      conversationId,
    })
  }

  async sendAndEmitProgress(
    ws: WS,
    runId: string,
    stage: PlanningStage,
    progressPct: number,
    message: string
  ): Promise<void> {
    this.send(ws, {
      type: 'plan.progress',
      payload: { runId, stage, progressPct, message },
    })

    await this.eventBus.emit('planner.progress', {
      runId,
      stage,
      progressPct,
      message,
    })
  }

  async sendAndEmitCompleted(
    ws: WS,
    runId: string,
    planId: string,
    blueprint: ExecutionBlueprint,
    validation: ValidationResult
  ): Promise<void> {
    await this.eventBus.emit('planner.completed', {
      runId,
      blueprintId: planId,
      taskCount: blueprint.tasks.length,
      estimatedComplexity: blueprint.estimatedComplexity,
    })

    this.send(ws, {
      type: 'plan.ready',
      payload: {
        runId,
        blueprint,
        planId,
        validation,
      },
    })
  }

  async sendAndEmitFailed(
    ws: WS,
    runId: string,
    code: string,
    stage: string,
    retries: number,
    message: string
  ): Promise<void> {
    await this.eventBus.emit('planner.failed', {
      runId,
      errorCode: code,
      stage,
      retries,
      message,
    })

    this.send(ws, {
      type: 'plan.error',
      payload: { runId, code, message, retries },
    })
  }
}
