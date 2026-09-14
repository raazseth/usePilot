import fs from 'node:fs'
import path from 'node:path'

import type {
  ExecutionOutcome,
  SkillReliability,
  WorkflowReliability,
} from '@usepilot/evaluation-types'
import type { ComposedExecutionReceipt } from '@usepilot/skill-types'

import { SkillEvaluator } from '../skill/skill-evaluator'
import { WorkflowEvaluator } from '../workflow/workflow-evaluator'

export interface WorkflowEvidenceComparison {
  workflowA: string
  workflowB: string
  selectedWorkflow: string
  reason: string
}

export interface ReliabilityEngineOptions {
  storagePath?: string | undefined
  skillEvaluator?: SkillEvaluator | undefined
  workflowEvaluator?: WorkflowEvaluator | undefined
}

interface PersistedReliabilityData {
  outcomes: ExecutionOutcome[]
}

/**
 * ReliabilityEngine — Manages aggregated reliability profiles for Skills and Workflows.
 *
 * Informs Agent strategy selection:
 * When multiple candidate workflows satisfy the same goal, prefers the workflow
 * with higher verified statistical evidence, provided risk is equal or lower.
 * Supports local-first persistence across restarts via storagePath.
 */
export class ReliabilityEngine {
  private readonly skillEvaluator: SkillEvaluator
  private readonly workflowEvaluator: WorkflowEvaluator
  private readonly storagePath?: string | undefined

  constructor(
    skillEvaluatorOrOptions?: SkillEvaluator | ReliabilityEngineOptions,
    workflowEvaluator?: WorkflowEvaluator
  ) {
    if (skillEvaluatorOrOptions && 'storagePath' in skillEvaluatorOrOptions) {
      this.storagePath = skillEvaluatorOrOptions.storagePath
      this.skillEvaluator = skillEvaluatorOrOptions.skillEvaluator ?? new SkillEvaluator()
      this.workflowEvaluator = skillEvaluatorOrOptions.workflowEvaluator ?? new WorkflowEvaluator()
    } else {
      this.skillEvaluator = (skillEvaluatorOrOptions as SkillEvaluator | undefined) ?? new SkillEvaluator()
      this.workflowEvaluator = workflowEvaluator ?? new WorkflowEvaluator()
    }

    if (this.storagePath && fs.existsSync(this.storagePath)) {
      try {
        const raw = fs.readFileSync(this.storagePath, 'utf8')
        const data = JSON.parse(raw) as PersistedReliabilityData
        if (Array.isArray(data.outcomes)) {
          this.skillEvaluator.recordBatch(data.outcomes)
          this.workflowEvaluator.recordBatch(data.outcomes.map((o) => ({ outcome: o })))
        }
      } catch {
        // Gracefully ignore corrupt storage file
      }
    }
  }

  private persist(): void {
    if (!this.storagePath) return
    try {
      const dir = path.dirname(this.storagePath)
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
      const data: PersistedReliabilityData = {
        outcomes: this.skillEvaluator.getOutcomes(),
      }
      fs.writeFileSync(this.storagePath, JSON.stringify(data, null, 2), 'utf8')
    } catch {
      // Best-effort local persistence
    }
  }

  record(outcome: ExecutionOutcome, receipt?: ComposedExecutionReceipt): void {
    this.skillEvaluator.record(outcome)
    this.workflowEvaluator.record(outcome, receipt)
    this.persist()
  }

  getSkillEvaluator(): SkillEvaluator {
    return this.skillEvaluator
  }

  getWorkflowEvaluator(): WorkflowEvaluator {
    return this.workflowEvaluator
  }

  getSkillReliability(skillId: string, version?: string): SkillReliability {
    return this.skillEvaluator.getReliability(skillId, version)
  }

  getWorkflowReliability(workflowId: string, version?: string): WorkflowReliability {
    return this.workflowEvaluator.getReliability(workflowId, version)
  }

  /**
   * Compares two valid candidate workflows for the same goal and selects
   * the one with stronger verified evidence.
   */
  recommendPreferredWorkflow(
    workflowA: string,
    workflowB: string
  ): WorkflowEvidenceComparison {
    const relA = this.getWorkflowReliability(workflowA)
    const relB = this.getWorkflowReliability(workflowB)

    // If both have no meaningful sample, keep workflowA default
    if (relA.confidence === 'NONE' && relB.confidence === 'NONE') {
      return {
        workflowA,
        workflowB,
        selectedWorkflow: workflowA,
        reason: 'Both workflows have insufficient sample history; choosing primary default.',
      }
    }

    // If only one has high confidence
    const confidenceScore = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 }
    const scoreA = confidenceScore[relA.confidence]
    const scoreB = confidenceScore[relB.confidence]

    // If one has significantly higher verified success rate with evidence
    if (relA.sampleCount >= 5 && relB.sampleCount >= 5) {
      if (relA.verificationRate > relB.verificationRate + 0.05) {
        return {
          workflowA,
          workflowB,
          selectedWorkflow: workflowA,
          reason: `Workflow "${workflowA}" has higher verified success rate (${(relA.verificationRate * 100).toFixed(1)}% vs ${(relB.verificationRate * 100).toFixed(1)}%).`,
        }
      }
      if (relB.verificationRate > relA.verificationRate + 0.05) {
        return {
          workflowA,
          workflowB,
          selectedWorkflow: workflowB,
          reason: `Workflow "${workflowB}" has higher verified success rate (${(relB.verificationRate * 100).toFixed(1)}% vs ${(relA.verificationRate * 100).toFixed(1)}%).`,
        }
      }
    }

    if (scoreB > scoreA && relB.successRate >= 0.8) {
      return {
        workflowA,
        workflowB,
        selectedWorkflow: workflowB,
        reason: `Workflow "${workflowB}" has significantly higher confidence and verified evidence.`,
      }
    }

    return {
      workflowA,
      workflowB,
      selectedWorkflow: workflowA,
      reason: `Workflow "${workflowA}" satisfies goal with equal or superior verified evidence.`,
    }
  }
}
