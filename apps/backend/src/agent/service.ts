import { join } from 'node:path'
import { MessageRepository } from '@usepilot/database'
import type { EventBus } from '../events/bus'
import type { Logger } from '../logger'
import {
  AgentOrchestrator,
  AgentContextFacade,
} from '@usepilot/agent-core'
import type { AgentEvent, AgentExecutionOutcome } from '@usepilot/agent-types'
import {
  createDefaultSkillRegistry,
  createDefaultCompositionRegistry,
  type SkillRegistry,
  type SkillCompositionRegistry,
} from '@usepilot/skill-core'
import {
  PreferenceEngine,
  ReliabilityEngine,
  OutcomeClassifier,
} from '@usepilot/evaluation-core'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

export interface AgentServiceOptions {
  db: DB
  eventBus: EventBus
  logger: Logger
  dataDir: string
}

export type ClientEventSender = (event: { type: string; payload: unknown }) => void

interface PendingGoal {
  goalId: string
  conversationId: string
  originalPrompt: string
  lastOutcome?: AgentExecutionOutcome | undefined
}

/**
 * AgentService — Bridges the Phase 8 Agent Orchestrator and Phase 9 Learning/Evaluation
 * with the usePilot backend server, WebSocket clients, and SQLite database.
 */
export class AgentService {
  private readonly db: DB
  private readonly eventBus: EventBus
  private readonly logger: Logger
  private readonly msgRepo: MessageRepository
  private readonly skillRegistry: SkillRegistry
  private readonly compositionRegistry: SkillCompositionRegistry
  private readonly contextFacade: AgentContextFacade
  private readonly preferenceEngine: PreferenceEngine
  private readonly reliabilityEngine: ReliabilityEngine
  private readonly outcomeClassifier: OutcomeClassifier
  private readonly pendingGoals = new Map<string, PendingGoal>()

  constructor(options: AgentServiceOptions) {
    this.db = options.db
    this.eventBus = options.eventBus
    this.logger = options.logger.child({ component: 'AgentService' })
    this.msgRepo = new MessageRepository(this.db)

    this.skillRegistry = createDefaultSkillRegistry()
    this.compositionRegistry = createDefaultCompositionRegistry()
    this.contextFacade = new AgentContextFacade()

    const prefPath = join(options.dataDir, 'preferences.json')
    const relPath = join(options.dataDir, 'reliability.json')

    this.preferenceEngine = new PreferenceEngine({ storagePath: prefPath })
    this.reliabilityEngine = new ReliabilityEngine({ storagePath: relPath })
    this.outcomeClassifier = new OutcomeClassifier()

    this.logger.info('AgentService initialized with default skills, compositions, and local persistence')
  }

  getSkillRegistry(): SkillRegistry {
    return this.skillRegistry
  }

  getCompositionRegistry(): SkillCompositionRegistry {
    return this.compositionRegistry
  }

  getPreferenceEngine(): PreferenceEngine {
    return this.preferenceEngine
  }

  getReliabilityEngine(): ReliabilityEngine {
    return this.reliabilityEngine
  }

  /**
   * Primary entry point for natural language goals.
   * Executes the full Agent reasoning -> Deterministic execution -> Verification cycle.
   */
  async handleGoal(
    conversationId: string,
    prompt: string,
    sendToClient?: ClientEventSender,
    options: { autoApprove?: boolean | undefined } = {}
  ): Promise<AgentExecutionOutcome> {
    this.logger.info({ conversationId, prompt }, 'Handling goal via AgentOrchestrator')

    const orchestrator = new AgentOrchestrator({
      skillRegistry: this.skillRegistry,
      compositionRegistry: this.compositionRegistry,
      contextFacade: this.contextFacade,
      eventSubscriber: (event: AgentEvent) => {
        // Forward to system event bus
        void this.eventBus.emit('agent.event', {
          type: event.type,
          agentId: event.agentId,
          goalId: event.goalId,
          state: event.state,
          payload: event.payload,
        })

        // Stream event to client
        if (sendToClient) {
          sendToClient({
            type: event.type,
            payload: {
              ...event.payload,
              agentId: event.agentId,
              goalId: event.goalId,
              state: event.state,
              timestamp: event.timestamp,
              conversationId,
            },
          })
        }
      },
    })

    const outcome = await orchestrator.execute(prompt, options)

    // Classify and record execution evidence into the Reliability Engine
    try {
      const classified = this.outcomeClassifier.classify({
        executionId: outcome.goalId,
        goalId: outcome.goalId,
        agentId: outcome.agentId,
        agentVersion: '0.1.0',
        workflowId: outcome.workflowId,
        durationMs: outcome.durationMs,
        replanCount: outcome.replanCount,
        clarificationRequired: outcome.status === 'CLARIFICATION_REQUIRED',
      })
      this.reliabilityEngine.record(classified)
    } catch (err) {
      this.logger.warn({ err }, 'Failed to record reliability evidence')
    }

    // Handle states requiring human-in-the-loop interaction
    if (outcome.status === 'CLARIFICATION_REQUIRED' || outcome.status === 'BLOCKED') {
      this.pendingGoals.set(outcome.goalId, {
        goalId: outcome.goalId,
        conversationId,
        originalPrompt: prompt,
        lastOutcome: outcome,
      })
    }

    // Persist assistant message in the conversation
    const assistantContent = outcome.userExplanation || outcome.summary
    try {
      const msg = await this.msgRepo.create({
        conversationId,
        role: 'assistant',
        content: assistantContent,
        status: 'complete',
      })

      // Send standard chat message completion so default UI renders response
      if (sendToClient) {
        sendToClient({
          type: 'message.started',
          payload: { messageId: msg.id, conversationId, model: 'agent-orchestrator' },
        })
        sendToClient({
          type: 'message.chunk',
          payload: { messageId: msg.id, conversationId, token: assistantContent, index: 0 },
        })
        sendToClient({
          type: 'message.finished',
          payload: { messageId: msg.id, conversationId, tokens: assistantContent.length, durationMs: outcome.durationMs },
        })

        // Send structured agent outcome
        sendToClient({
          type: 'agent.outcome',
          payload: { ...outcome, conversationId },
        })
      }
    } catch (err) {
      this.logger.error({ err }, 'Failed to save agent response to message repository')
    }

    return outcome
  }

  /**
   * Resumes a goal that previously stopped for clarification with user's supplemental input.
   */
  async respondToClarification(
    conversationId: string,
    goalId: string,
    clarification: string,
    sendToClient?: ClientEventSender
  ): Promise<AgentExecutionOutcome> {
    const pending = this.pendingGoals.get(goalId)
    const combinedPrompt = pending
      ? `${pending.originalPrompt}. Additional details: ${clarification}`
      : clarification

    this.pendingGoals.delete(goalId)
    return this.handleGoal(conversationId, combinedPrompt, sendToClient)
  }

  /**
   * Resumes a goal that previously stopped for human approval.
   */
  async respondToApproval(
    conversationId: string,
    goalId: string,
    approved: boolean,
    sendToClient?: ClientEventSender
  ): Promise<AgentExecutionOutcome> {
    const pending = this.pendingGoals.get(goalId)
    if (!pending) {
      throw new Error(`No pending goal found with ID "${goalId}"`)
    }

    this.pendingGoals.delete(goalId)

    if (!approved) {
      const rejectedOutcome: AgentExecutionOutcome = {
        status: 'BLOCKED',
        agentId: pending.lastOutcome?.agentId ?? 'agent-computer-use',
        goalId,
        workflowId: pending.lastOutcome?.workflowId,
        verificationStatus: false,
        summary: 'Goal rejected by user during approval gate.',
        durationMs: 0,
        replanCount: 0,
        userExplanation: 'Action was cancelled by user.',
      }

      if (sendToClient) {
        sendToClient({
          type: 'agent.rejected',
          payload: { ...rejectedOutcome, conversationId },
        })
      }

      return rejectedOutcome
    }

    // User approved: resume with autoApprove: true
    return this.handleGoal(conversationId, pending.originalPrompt, sendToClient, {
      autoApprove: true,
    })
  }
}
