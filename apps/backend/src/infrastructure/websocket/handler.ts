import type { ServerWebSocket } from 'bun'
import { generateId, toTimestamp } from '@usepilot/utils'
import { AIProviderError } from '@usepilot/ai-core'
import { ConversationRepository, MessageRepository } from '@usepilot/database'
import type { ClientEvent, MessageSendPayload, MessageStopPayload } from '@usepilot/types'
import type { ProviderManager } from '../ai/provider-manager'
import type { EventBus } from '../../events/bus'
import type { Logger } from '../../logger'
import type { PlannerService } from '../../planner/service'
import { RequestClassifier } from '@usepilot/planner-core'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

interface WSData {
  requestId: string
}

interface ActiveStream {
  abortController: AbortController
  messageId: string
  conversationId: string
}

/**
 * WebSocket handler implementing the unified AppEvent protocol.
 * Manages streaming lifecycles and propagates events to the event bus.
 */
export class WebSocketHandler {
  private readonly activeStreams = new Map<string, ActiveStream>()
  private readonly convRepo: ConversationRepository
  private readonly msgRepo: MessageRepository

  constructor(
    private readonly db: DB,
    private readonly providerManager: ProviderManager,
    private readonly eventBus: EventBus,
    private readonly logger: Logger,
    private readonly plannerService?: PlannerService
  ) {
    this.convRepo = new ConversationRepository(this.db)
    this.msgRepo = new MessageRepository(this.db)
  }

  readonly handlers: import('bun').WebSocketHandler<WSData> = {
    open: (ws) => {
      this.logger.info({ requestId: ws.data.requestId }, 'WebSocket connected')
      this.send(ws, {
        type: 'health.pong',
        payload: { status: 'ok', version: '0.1.0', uptime: process.uptime() },
      })
    },

    message: async (ws, raw) => {
      const requestId = ws.data.requestId
      let event: ClientEvent

      try {
        event = JSON.parse(raw as string) as ClientEvent
      } catch {
        this.sendError(ws, { code: 'INVALID_JSON', message: 'Could not parse event' })
        return
      }

      const childLogger = this.logger.child({
        requestId,
        eventType: event.type,
        conversationId: (event.payload as Record<string, unknown>)['conversationId'] as string | undefined,
      })

      try {
        switch (event.type) {
          case 'message.send':
            await this.handleMessageSend(ws, event.payload as MessageSendPayload, childLogger)
            break

          case 'message.stop':
            await this.handleMessageStop(ws, event.payload as MessageStopPayload, childLogger)
            break

          case 'plan.create': {
            const payload = event.payload as { conversationId: string; text: string }
            if (!this.plannerService) {
              this.sendError(ws, { code: 'PLANNER_UNAVAILABLE', message: 'Planner service is not initialized' })
              break
            }
            // Run async — progress events are streamed as they happen
            void this.plannerService.createPlan(ws, payload.conversationId, payload.text)
              .catch((err: unknown) => {
                childLogger.error({ err }, 'PlannerService.createPlan threw unexpectedly')
              })
            break
          }

          case 'plan.get': {
            const payload = event.payload as { planId: string }
            if (!this.plannerService) {
              this.sendError(ws, { code: 'PLANNER_UNAVAILABLE', message: 'Planner service is not initialized' })
              break
            }
            await this.plannerService.getPlan(ws, payload.planId)
            break
          }

          case 'health.ping':
            this.send(ws, {
              type: 'health.pong',
              payload: { status: 'ok', version: '0.1.0', uptime: process.uptime() },
            })
            break

          default:
            this.sendError(ws, { code: 'UNKNOWN_EVENT', message: `Unknown event type: ${event.type}` })
        }
      } catch (error) {
        childLogger.error({ err: error }, 'Event handler failed')
        this.sendError(ws, { code: 'INTERNAL_ERROR', message: 'Internal server error' })
      }
    },

    close: (ws, code, reason) => {
      this.logger.info({ requestId: ws.data.requestId, code, reason }, 'WebSocket disconnected')
    },
  }

  private async handleMessageSend(
    ws: ServerWebSocket<WSData>,
    payload: MessageSendPayload,
    logger: Logger
  ): Promise<void> {
    const { conversationId, content, model, temperature, maxTokens } = payload

    // Verify conversation exists
    const conversation = await this.convRepo.findById(conversationId)
    if (!conversation) {
      this.sendError(ws, { code: 'NOT_FOUND', message: 'Conversation not found' })
      return
    }

    const provider = this.providerManager.getActive()
    if (!provider) {
      this.sendError(ws, { code: 'NO_PROVIDER', message: 'No AI provider is configured' })
      return
    }

    // Resolve model to use — fallback to provider's installed model if requested model is missing
    let targetModel = model || conversation.model || undefined
    try {
      const availableModels = await provider.listModels()
      if (availableModels.length > 0) {
        const match = targetModel ? availableModels.find((m) => m.id === targetModel || m.name === targetModel) : null
        if (!match) {
          logger.warn(
            { requested: targetModel, fallback: availableModels[0]?.id },
            `Model "${targetModel}" not installed in ${provider.name}. Falling back to "${availableModels[0]?.id}".`
          )
          targetModel = availableModels[0]?.id
        }
      }
    } catch {
      // Best effort fallback
    }

    if (!targetModel) {
      targetModel = 'qwen2.5-coder:3b'
    }

    // Save user message
    await this.msgRepo.create({
      conversationId,
      role: 'user',
      content,
      status: 'complete',
    })

    // Phase 2: Route request through RequestClassifier
    if (this.plannerService) {
      const classifier = new RequestClassifier(provider)
      const classification = await classifier.classify(content, targetModel)

      if (classification.type === 'planning') {
        logger.info(
          { signals: classification.signals, reason: classification.reason, confidence: classification.confidence },
          'Natural language input classified as planning — dispatching to PlannerService'
        )
        void this.plannerService.createPlan(ws, conversationId, content)
          .catch((err: unknown) => {
            logger.error({ err }, 'PlannerService.createPlan threw')
          })
        return
      }

      if (classification.type === 'execution') {
        const assistantMsg = await this.msgRepo.create({
          conversationId,
          role: 'assistant',
          content: 'Execution Engine will be activated in Phase 3. Your blueprint is ready and validated for execution.',
          status: 'complete',
        })
        this.send(ws, {
          type: 'message.started',
          payload: { messageId: assistantMsg.id, conversationId, model: targetModel },
        })
        this.send(ws, {
          type: 'message.chunk',
          payload: { messageId: assistantMsg.id, conversationId, token: assistantMsg.content, index: 0 },
        })
        this.send(ws, {
          type: 'message.finished',
          payload: { messageId: assistantMsg.id, conversationId, tokens: 18, durationMs: 10 },
        })
        return
      }
    }

    // Create assistant message (pending)
    const assistantMsg = await this.msgRepo.create({
      conversationId,
      role: 'assistant',
      content: '',
      status: 'streaming',
    })

    const messageId = assistantMsg.id

    // Notify started
    this.send(ws, {
      type: 'message.started',
      payload: {
        messageId,
        conversationId,
        model: targetModel,
      },
    })

    await this.eventBus.emit('message.streaming.started', {
      id: messageId,
      conversationId,
      model: targetModel,
    })

    // Build message history for context
    const history = await this.msgRepo.findByConversationId(conversationId)
    const messages = history
      .filter((m) => m.id !== messageId && m.status === 'complete')
      .map((m) => ({ role: m.role as 'user' | 'assistant' | 'system', content: m.content ?? '' }))

    // Set up abort controller for stop support
    const abortController = new AbortController()
    this.activeStreams.set(conversationId, { abortController, messageId, conversationId })

    const start = Date.now()
    let fullContent = ''
    let chunkIndex = 0

    try {
      const stream = provider.streamChat({
        messages,
        model: targetModel,
        temperature: temperature ?? undefined,
        maxTokens: maxTokens ?? undefined,
        signal: abortController.signal,
      })

      for await (const chunk of stream) {
        if (chunk.token) {
          fullContent += chunk.token

          this.send(ws, {
            type: 'message.chunk',
            payload: {
              messageId,
              conversationId,
              token: chunk.token,
              index: chunkIndex++,
            },
          })

          await this.eventBus.emit('message.chunk.received', {
            id: messageId,
            conversationId,
            token: chunk.token,
            index: chunkIndex,
          })
        }

        if (chunk.done) {
          const durationMs = Date.now() - start

          // Finalize assistant message in DB
          await this.msgRepo.update(messageId, {
            content: fullContent,
            status: 'complete',
            metadata: {
              model: targetModel,
              finishReason: chunk.finishReason ?? 'stop',
              usage: chunk.usage ?? undefined,
              provider: provider.name,
              generationDurationMs: durationMs,
            },
          })

          await this.convRepo.touchUpdatedAt(conversationId)

          this.send(ws, {
            type: 'message.finished',
            payload: {
              messageId,
              conversationId,
              finishReason: chunk.finishReason ?? 'stop',
              usage: chunk.usage,
            },
          })

          await this.eventBus.emit('message.streaming.finished', {
            id: messageId,
            conversationId,
            content: fullContent,
            usage: chunk.usage ?? undefined,
          })

          logger.info({ messageId, conversationId, durationMs, provider: provider.name }, 'Message complete')
        }
      }
    } catch (error) {
      const isCancelled =
        abortController.signal.aborted ||
        (error instanceof AIProviderError && error.code === 'REQUEST_ABORTED')

      if (isCancelled) {
        await this.msgRepo.update(messageId, { content: fullContent, status: 'cancelled' })
        this.send(ws, { type: 'message.error', payload: { messageId, conversationId, code: 'CANCELLED', message: 'Generation stopped' } })
      } else {
        const message = error instanceof Error ? error.message : 'Unknown error'
        logger.error({ err: error, messageId, conversationId }, 'Stream error')
        await this.msgRepo.update(messageId, { content: fullContent, status: 'error' })
        this.send(ws, { type: 'message.error', payload: { messageId, conversationId, code: 'STREAM_ERROR', message } })
        await this.eventBus.emit('message.error', { id: messageId, conversationId, error: error as Error })
      }
    } finally {
      this.activeStreams.delete(conversationId)
    }
  }

  private async handleMessageStop(
    ws: ServerWebSocket<WSData>,
    payload: MessageStopPayload,
    logger: Logger
  ): Promise<void> {
    const { conversationId } = payload
    const stream = this.activeStreams.get(conversationId)

    if (!stream) {
      logger.debug({ conversationId }, 'Stop requested but no active stream')
      return
    }

    stream.abortController.abort()
    this.activeStreams.delete(conversationId)
    logger.info({ conversationId, messageId: stream.messageId }, 'Stream cancelled by user')
  }

  private send(ws: ServerWebSocket<WSData>, data: { type: string; payload: unknown }) {
    const event = {
      id: generateId(),
      type: data.type,
      timestamp: new Date().toISOString(),
      payload: data.payload,
    }
    ws.send(JSON.stringify(event))
  }

  private sendError(ws: ServerWebSocket<WSData>, error: { code: string; message: string }) {
    this.send(ws, { type: 'error', payload: error })
  }
}
