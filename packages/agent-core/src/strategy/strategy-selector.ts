import type {
  AgentGoal,
  AgentDecision,
} from '@usepilot/agent-types'
import type {
  SkillRegistry,
  SkillCompositionRegistry} from '@usepilot/skill-core';
import {
  GoalWorkflowRouter,
  CompositionValidator,
} from '@usepilot/skill-core'
import type { SkillComposition } from '@usepilot/skill-types'

import type { RetrievedAgentContext } from '../context/agent-context-facade'

export interface IReliabilityProvider {
  recommendPreferredWorkflow(workflowA: string, workflowB: string): { selectedWorkflow: string; reason: string }
}

export interface IPreferenceProvider {
  resolve(context: { key: string; explicitInput?: unknown; systemSafetyPermitted: boolean; currentRuntimeValid: boolean; safeDefault: unknown }): { resolvedValue: unknown; resolvedSource: string; reason: string }
}

export interface StrategySelectorOptions {
  skillRegistry: SkillRegistry
  compositionRegistry: SkillCompositionRegistry
  reliabilityProvider?: IReliabilityProvider | undefined
  preferenceProvider?: IPreferenceProvider | undefined
}

/**
 * AgentStrategySelector — Reasons over candidate strategies to select or compose
 * the simplest, safest workflow that fulfills the user's objective.
 *
 * Evaluation hierarchy:
 * 1. Safety Policy Check (reject destructive commands immediately)
 * 2. Missing Information Check (halt with CLARIFY before executing)
 * 3. Existing Workflow Reuse (highest preference for multi-step goals)
 * 4. Dynamic Multi-Skill Composition (when novel combination is required)
 * 5. Single Skill Execution (when one skill completely covers the goal)
 * 6. Unsupported Rejection (when outside capabilities)
 */
export class AgentStrategySelector {
  private readonly router: GoalWorkflowRouter
  private readonly validator: CompositionValidator
  private readonly compositionRegistry: SkillCompositionRegistry
  private readonly options: StrategySelectorOptions

  constructor(options: StrategySelectorOptions) {
    this.options = options
    this.compositionRegistry = options.compositionRegistry
    this.router = new GoalWorkflowRouter(options.skillRegistry, options.compositionRegistry)
    this.validator = new CompositionValidator(options.skillRegistry)
  }

  selectStrategy(goal: AgentGoal, context?: RetrievedAgentContext): AgentDecision {
    // 1. Safety check
    if (goal.riskLevel === 'critical') {
      return {
        decisionType: 'REJECT',
        goal,
        strategy: 'Safety Violation Rejection',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: 'critical',
        requiredApproval: false,
        missingInformation: [],
        reason: 'Goal requests destructive modifications to operating system files or drive formats.',
      }
    }

    // 2. Missing information check (Clarification boundary)
    if (goal.missingInformation.length > 0) {
      return {
        decisionType: 'CLARIFY',
        goal,
        strategy: 'Request Missing Information',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: false,
        missingInformation: goal.missingInformation,
        reason: `Execution cannot proceed safely without required parameter(s): ${goal.missingInformation.join(', ')}.`,
      }
    }

    // 3. Consult GoalWorkflowRouter for composition matching / dynamic synthesis
    let effectiveGoal = goal.rawInput
    if (context?.hot.activeUrl && !/https?:\/\//.test(effectiveGoal)) {
      effectiveGoal = effectiveGoal.replace(/\b(?:this\s+(?:website|site|page)|current\s+page|here)\b/gi, context.hot.activeUrl)
    }
    const coldReportsFolder = context?.cold.userPreferences['defaultReportsFolder'] as string | undefined
    let preferredReportsFolder = coldReportsFolder
    if (!preferredReportsFolder && this.options.preferenceProvider) {
      const resolved = this.options.preferenceProvider.resolve({
        key: 'defaultReportsFolder',
        systemSafetyPermitted: true,
        currentRuntimeValid: true,
        safeDefault: undefined,
      })
      if (typeof resolved.resolvedValue === 'string') {
        preferredReportsFolder = resolved.resolvedValue
      }
    }
    if (preferredReportsFolder && /\b(?:my\s+reports?\s+folder|reports?\s+folder)\b/i.test(effectiveGoal)) {
      effectiveGoal = effectiveGoal.replace(/\b(?:my\s+reports?\s+folder|reports?\s+folder)\b/gi, preferredReportsFolder)
    }
    const hotFolder = context?.hot.currentFolder
    if (hotFolder && /\bhere\b/i.test(effectiveGoal)) {
      effectiveGoal = effectiveGoal.replace(/\bhere\b/gi, hotFolder)
    }

    const routeResult = this.router.route({
      goal: effectiveGoal,
      context: context?.cold.userPreferences,
    })

    if (routeResult.status === 'destructive_rejected') {
      return {
        decisionType: 'REJECT',
        goal,
        strategy: 'Destructive Action Guard',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: 'critical',
        requiredApproval: false,
        missingInformation: [],
        reason: routeResult.reason,
      }
    }

    if (routeResult.status === 'conflicting_requirements') {
      return {
        decisionType: 'CLARIFY',
        goal,
        strategy: 'Resolve Conflicting Constraints',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: false,
        missingInformation: [],
        reason: routeResult.reason,
        alternatives: routeResult.detectedConflicts,
      }
    }

    if (routeResult.status === 'requires_clarification') {
      return {
        decisionType: 'CLARIFY',
        goal,
        strategy: 'Clarify Intent',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: false,
        missingInformation: routeResult.missingInputs ?? [],
        reason: routeResult.reason,
      }
    }

    if (routeResult.status === 'unsupported') {
      return {
        decisionType: 'REJECT',
        goal,
        strategy: 'Unsupported Capability',
        selectedSkills: [],
        confidence: 'HIGH',
        riskLevel: 'low',
        requiredApproval: false,
        missingInformation: [],
        reason: routeResult.reason,
      }
    }

    // 4. Predefined Workflow Reuse (Preferred over Dynamic Composition)
    if (routeResult.status === 'matched_composition' && routeResult.composition) {
      let comp = routeResult.composition
      if (this.options.reliabilityProvider) {
        const otherComps = this.compositionRegistry.list().filter((c) => c.id !== comp.id)
        for (const candidate of otherComps) {
          const sharesSkill = candidate.steps.some((s) => comp.steps.some((cs) => cs.skillId === s.skillId))
          if (sharesSkill) {
            const comparison = this.options.reliabilityProvider.recommendPreferredWorkflow(comp.id, candidate.id)
            if (comparison.selectedWorkflow === candidate.id) {
              comp = candidate
              break
            }
          }
        }
      }
      const skills = comp.steps.map((s) => s.skillId)

      return {
        decisionType: 'REUSE_WORKFLOW',
        goal,
        strategy: `Reuse Predefined Workflow: ${comp.name}`,
        selectedSkills: skills,
        selectedWorkflow: comp.id,
        workflowDefinition: comp,
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: goal.riskLevel === 'high' || comp.steps.some((s) => s.skillId === 'bulk-rename-files'),
        missingInformation: [],
        reason: `Existing predefined composition "${comp.name}" matches all requested objectives with validated DAG dependencies.`,
      }
    }

    // 5. Dynamic Multi-Skill Composition
    if (routeResult.status === 'dynamic_composition' && routeResult.composition) {
      const comp = routeResult.composition
      const validation = this.validator.validate(comp)

      if (!validation.valid) {
        return {
          decisionType: 'REJECT',
          goal,
          strategy: 'Invalid Composition Graph',
          selectedSkills: comp.steps.map((s) => s.skillId),
          confidence: 'HIGH',
          riskLevel: 'high',
          requiredApproval: false,
          missingInformation: [],
          reason: `Dynamically generated composition failed DAG validation: ${validation.errors.map((e) => e.detail).join('; ')}`,
        }
      }

      return {
        decisionType: 'COMPOSE',
        goal,
        strategy: `Dynamic Multi-Skill Composition (${comp.steps.length} steps)`,
        selectedSkills: comp.steps.map((s) => s.skillId),
        workflowDefinition: comp,
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: goal.riskLevel === 'high' || comp.steps.some((s) => s.skillId === 'bulk-rename-files'),
        missingInformation: [],
        reason: `Dynamically composed a novel ${comp.steps.length}-step DAG workflow satisfying sequential requirements.`,
        alternatives: routeResult.suggestedSteps,
      }
    }

    // 6. Single Skill Execution
    if (routeResult.status === 'single_skill' && routeResult.singleSkillId) {
      const skillId = routeResult.singleSkillId
      // Wrap single skill into a 1-step composition for unified execution
      const singleComp: SkillComposition = {
        id: `single-${skillId}`,
        name: `Single Skill Execution: ${skillId}`,
        description: `Wrapper composition for ${skillId}`,
        version: '1.0.0',
        steps: [
          {
            stepId: 'step-1',
            skillId,
            inputBindings: {},
          },
        ],
      }

      return {
        decisionType: 'EXECUTE',
        goal,
        strategy: `Single Skill Execution: ${skillId}`,
        selectedSkills: [skillId],
        selectedWorkflow: singleComp.id,
        workflowDefinition: singleComp,
        confidence: 'HIGH',
        riskLevel: goal.riskLevel,
        requiredApproval: goal.riskLevel === 'high',
        missingInformation: [],
        reason: `Objective is completely covered by individual skill "${skillId}".`,
      }
    }

    // Fallback: Reject unsupported
    return {
      decisionType: 'REJECT',
      goal,
      strategy: 'No Strategy Found',
      selectedSkills: [],
      confidence: 'LOW',
      riskLevel: 'low',
      requiredApproval: false,
      missingInformation: [],
      reason: 'No combination of skills or workflows could be formulated for this goal.',
    }
  }
}
