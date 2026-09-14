import type {
  AgentGoal,
  AgentDecision,
  AgentExecutionOutcome,
  AgentEvent,
  AgentLifecycleState,
} from '@usepilot/agent-types'
import type {
  SkillCompositionRegistry,
  SkillRegistry} from '@usepilot/skill-core';
import {
  ComposedWorkflowOrchestrator,
  CompositionValidator
} from '@usepilot/skill-core'

import type { RetrievedAgentContext } from '../context/agent-context-facade'
import { AgentContextFacade } from '../context/agent-context-facade'
import { AgentGoalAnalyzer } from '../goal/goal-analyzer'
import { AgentOutcomeInterpreter } from '../outcome/outcome-interpreter'
import { AgentWorkflowParameterizer } from '../parameterizer/workflow-parameterizer'
import { AgentRecoveryController } from '../recovery/recovery-controller'
import { AgentRegistry, DEFAULT_COMPUTER_AGENT_MANIFEST } from '../registry/agent-registry'
import { AgentStrategySelector } from '../strategy/strategy-selector'

export type AgentEventSubscriber = (event: AgentEvent) => void

export interface AgentOrchestratorOptions {
  agentRegistry?: AgentRegistry | undefined
  skillRegistry: SkillRegistry
  compositionRegistry: SkillCompositionRegistry
  contextFacade?: AgentContextFacade | undefined
  orchestrator?: ComposedWorkflowOrchestrator | undefined
  eventSubscriber?: AgentEventSubscriber | undefined
  agentId?: string | undefined
}

/**
 * AgentOrchestrator — Central Intelligence & Lifecycle Orchestrator for Phase 8.
 *
 * Drives the 15-state lifecycle:
 * RECEIVED → UNDERSTANDING → CONTEXT_RETRIEVAL → STRATEGY_SELECTION →
 * (CLARIFICATION_REQUIRED | REJECTED | WORKFLOW_BUILDING → WORKFLOW_VALIDATION →
 * APPROVAL_REQUIRED → EXECUTING → VERIFYING → OUTCOME_ANALYSIS → REPLANNING →
 * COMPLETED | FAILED)
 *
 * Core Invariant:
 * The Agent reasons and orchestrates. The existing deterministic runtime executes.
 */
export class AgentOrchestrator {
  private currentState: AgentLifecycleState = 'RECEIVED'
  private readonly agentId: string
  private readonly agentRegistry: AgentRegistry
  private readonly contextFacade: AgentContextFacade
  private readonly goalAnalyzer: AgentGoalAnalyzer
  private readonly strategySelector: AgentStrategySelector
  private readonly parameterizer: AgentWorkflowParameterizer
  private readonly recoveryController: AgentRecoveryController
  private readonly outcomeInterpreter: AgentOutcomeInterpreter
  private readonly validator: CompositionValidator
  private readonly orchestrator: ComposedWorkflowOrchestrator
  private readonly eventSubscriber?: AgentEventSubscriber | undefined

  constructor(options: AgentOrchestratorOptions) {
    this.agentRegistry = options.agentRegistry ?? new AgentRegistry()
    this.agentId = options.agentId ?? DEFAULT_COMPUTER_AGENT_MANIFEST.id
    this.contextFacade = options.contextFacade ?? new AgentContextFacade()
    this.goalAnalyzer = new AgentGoalAnalyzer()
    this.strategySelector = new AgentStrategySelector({
      skillRegistry: options.skillRegistry,
      compositionRegistry: options.compositionRegistry,
    })
    this.parameterizer = new AgentWorkflowParameterizer()
    this.recoveryController = new AgentRecoveryController()
    this.outcomeInterpreter = new AgentOutcomeInterpreter()
    this.validator = new CompositionValidator(options.skillRegistry)
    this.orchestrator = options.orchestrator ?? new ComposedWorkflowOrchestrator(
      options.skillRegistry
    )
    this.eventSubscriber = options.eventSubscriber
  }

  getState(): AgentLifecycleState {
    return this.currentState
  }

  private transition(state: AgentLifecycleState, goalId: string, payload?: Record<string, unknown>): void {
    this.currentState = state
    if (this.eventSubscriber) {
      let eventType: AgentEvent['type'] = 'agent.started'
      switch (state) {
        case 'RECEIVED':
          eventType = 'agent.started'
          break
        case 'UNDERSTANDING':
          eventType = 'agent.goal_understood'
          break
        case 'CONTEXT_RETRIEVAL':
          eventType = 'agent.context_retrieved'
          break
        case 'STRATEGY_SELECTION':
          eventType = 'agent.strategy_selected'
          break
        case 'CLARIFICATION_REQUIRED':
          eventType = 'agent.clarification_required'
          break
        case 'APPROVAL_REQUIRED':
          eventType = 'agent.approval_required'
          break
        case 'EXECUTING':
          eventType = 'agent.execution_started'
          break
        case 'VERIFYING':
          eventType = 'agent.verification_completed'
          break
        case 'REPLANNING':
          eventType = 'agent.replan_started'
          break
        case 'COMPLETED':
          eventType = 'agent.completed'
          break
        case 'FAILED':
          eventType = 'agent.failed'
          break
        case 'REJECTED':
          eventType = 'agent.rejected'
          break
      }

      this.eventSubscriber({
        type: eventType,
        agentId: this.agentId,
        goalId,
        timestamp: Date.now(),
        state,
        payload,
      })
    }
  }

  async execute(
    prompt: string,
    options: {
      autoApprove?: boolean | undefined
      contextOverride?: Partial<RetrievedAgentContext> | undefined
    } = {}
  ): Promise<AgentExecutionOutcome> {
    const startTime = Date.now()
    this.recoveryController.reset()

    // 1. RECEIVED
    const initialGoalId = `goal-${Date.now()}`
    this.transition('RECEIVED', initialGoalId, { rawPrompt: prompt })

    // 2. CONTEXT_RETRIEVAL
    this.transition('CONTEXT_RETRIEVAL', initialGoalId)
    const context = this.contextFacade.retrieveContext(prompt)
    if (options.contextOverride?.hot) Object.assign(context.hot, options.contextOverride.hot)
    if (options.contextOverride?.cold) Object.assign(context.cold, options.contextOverride.cold)

    // 3. UNDERSTANDING
    this.transition('UNDERSTANDING', initialGoalId)
    const goal: AgentGoal = this.goalAnalyzer.analyze(prompt, context)
    const goalId = goal.id

    // Check prompt injection attack
    if (this.goalAnalyzer.isPromptInjection(prompt)) {
      this.transition('REJECTED', goalId, { reason: 'Prompt injection attempt detected.' })
      return {
        status: 'BLOCKED',
        agentId: this.agentId,
        goalId,
        verificationStatus: false,
        summary: 'Goal rejected: prompt injection attempt detected.',
        durationMs: Date.now() - startTime,
        replanCount: 0,
        userExplanation: 'Request was blocked because it contained untrusted command injection directives.',
      }
    }

    // 4. STRATEGY_SELECTION
    this.transition('STRATEGY_SELECTION', goalId)
    const decision: AgentDecision = this.strategySelector.selectStrategy(goal, context)

    // Handle early exits
    if (decision.decisionType === 'REJECT') {
      this.transition('REJECTED', goalId, { reason: decision.reason })
      return {
        status: 'BLOCKED',
        agentId: this.agentId,
        goalId,
        verificationStatus: false,
        summary: `Goal rejected: ${decision.reason}`,
        durationMs: Date.now() - startTime,
        replanCount: 0,
        userExplanation: decision.reason,
      }
    }

    if (decision.decisionType === 'CLARIFY') {
      this.transition('CLARIFICATION_REQUIRED', goalId, { missing: decision.missingInformation })
      return {
        status: 'CLARIFICATION_REQUIRED',
        agentId: this.agentId,
        goalId,
        verificationStatus: false,
        summary: `Clarification required: ${decision.reason}`,
        durationMs: Date.now() - startTime,
        replanCount: 0,
        userExplanation: `I need more information to proceed safely: ${decision.missingInformation.join(', ')}.`,
      }
    }

    if (!decision.workflowDefinition) {
      this.transition('FAILED', goalId, { reason: 'No workflow definition associated with decision.' })
      return {
        status: 'EXECUTION_FAILURE',
        agentId: this.agentId,
        goalId,
        verificationStatus: false,
        summary: 'Workflow definition missing from decision.',
        durationMs: Date.now() - startTime,
        replanCount: 0,
        userExplanation: 'Internal error: workflow definition was not properly resolved.',
      }
    }

    let activeComposition = decision.workflowDefinition

    // Execution & Recovery Loop (Bounded)
    while (this.recoveryController.getIterations() <= 5) {
      // 5. WORKFLOW_BUILDING (Parameterization)
      this.transition('WORKFLOW_BUILDING', goalId, { workflowId: activeComposition.id })
      const paramResult = this.parameterizer.parameterize(goal, activeComposition, context)

      if (paramResult.missingRequired.length > 0) {
        this.transition('CLARIFICATION_REQUIRED', goalId, { missing: paramResult.missingRequired })
        return {
          status: 'CLARIFICATION_REQUIRED',
          agentId: this.agentId,
          goalId,
          workflowId: activeComposition.id,
          verificationStatus: false,
          summary: `Missing mandatory parameter(s): ${paramResult.missingRequired.join(', ')}`,
          durationMs: Date.now() - startTime,
          replanCount: this.recoveryController.getReplans(),
          userExplanation: `Please specify the following required parameter(s): ${paramResult.missingRequired.join(', ')}.`,
        }
      }

      // 6. WORKFLOW_VALIDATION
      this.transition('WORKFLOW_VALIDATION', goalId, { workflowId: activeComposition.id })
      const validation = this.validator.validate(activeComposition)
      if (!validation.valid) {
        this.transition('FAILED', goalId, { errors: validation.errors })
        return {
          status: 'EXECUTION_FAILURE',
          agentId: this.agentId,
          goalId,
          workflowId: activeComposition.id,
          verificationStatus: false,
          summary: `Composition DAG validation failed: ${validation.errors.map((e) => e.detail).join('; ')}`,
          durationMs: Date.now() - startTime,
          replanCount: this.recoveryController.getReplans(),
          userExplanation: 'The workflow could not be validated due to structural dependency errors.',
        }
      }

      // 7. APPROVAL_REQUIRED Check
      if (decision.requiredApproval && !options.autoApprove) {
        this.transition('APPROVAL_REQUIRED', goalId, { workflowId: activeComposition.id })
        return {
          status: 'BLOCKED',
          agentId: this.agentId,
          goalId,
          workflowId: activeComposition.id,
          verificationStatus: false,
          summary: 'Workflow requires user approval before modifying files.',
          durationMs: Date.now() - startTime,
          replanCount: this.recoveryController.getReplans(),
          userExplanation: `Action requires approval because of ${decision.riskLevel} risk level.`,
        }
      }

      // 8. EXECUTING (via existing deterministic runtime)
      this.transition('EXECUTING', goalId, { workflowId: activeComposition.id })
      const receipt = await this.orchestrator.execute(
        activeComposition,
        paramResult.inputs
      )

      // 9. VERIFYING & 10. OUTCOME_ANALYSIS
      this.transition('VERIFYING', goalId, { receiptStatus: receipt.status })
      this.transition('OUTCOME_ANALYSIS', goalId)
      const outcome = this.outcomeInterpreter.interpret(
        this.agentId,
        goalId,
        receipt,
        this.recoveryController.getReplans(),
        Date.now() - startTime
      )

      // Check if execution succeeded
      if (outcome.status === 'SUCCESS' || outcome.status === 'PARTIAL_SUCCESS') {
        this.contextFacade.recordExecution({
          workflowId: activeComposition.id,
          status: 'completed',
          tasksExecuted: receipt.totalTasksExecuted,
          durationMs: outcome.durationMs,
        })
        this.transition('COMPLETED', goalId, { outcomeStatus: outcome.status })
        return outcome
      }

      // Check if paused for approval
      if (outcome.status === 'BLOCKED') {
        this.transition('APPROVAL_REQUIRED', goalId)
        return outcome
      }

      // Handle Failure / Recovery Replan
      const recovery = this.recoveryController.evaluateFailure(
        outcome.summary,
        receipt.pendingApprovalStepId,
        activeComposition
      )

      if (recovery.action === 'REPLAN' && recovery.revisedComposition) {
        this.transition('REPLANNING', goalId, { reason: recovery.reason })
        activeComposition = recovery.revisedComposition
        continue
      }

      // Permanent failure
      this.contextFacade.recordExecution({
        workflowId: activeComposition.id,
        status: 'failed',
        tasksExecuted: receipt.totalTasksExecuted,
        durationMs: outcome.durationMs,
        error: outcome.summary,
      })
      this.transition('FAILED', goalId, { error: outcome.summary })
      return outcome
    }

    // Exceeded maximum iterations
    this.transition('FAILED', goalId, { error: 'Exceeded maximum agent iterations.' })
    return {
      status: 'EXECUTION_FAILURE',
      agentId: this.agentId,
      goalId,
      verificationStatus: false,
      summary: 'Terminated: loop boundary reached.',
      durationMs: Date.now() - startTime,
      replanCount: this.recoveryController.getReplans(),
      userExplanation: 'Execution was stopped to prevent an unbounded loop.',
    }
  }
}
