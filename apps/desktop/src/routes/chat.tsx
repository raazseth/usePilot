import type { ExecutionBlueprint, ValidationResult, PlanningStage } from '@usepilot/planner-types'
import type { Message, ConversationSummary } from '@usepilot/types'
import { generateId } from '@usepilot/utils'
import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'


import { ChatInput } from '../components/chat/ChatInput'
import { EmptyState } from '../components/chat/EmptyState'
import { ExecutionPanel } from '../components/execution/ExecutionPanel'
import { MessageBubble } from '../components/chat/MessageBubble'
import { PlanCard, PlanningProgress } from '../components/planner'
import { Spinner } from '../components/ui/Spinner'
import { apiClient } from '../shared/api/client'
import { wsManager } from '../shared/api/websocket'
import { useAppStore } from '../shared/store/appStore'
import './chat.css'

interface StreamingMessage {
  id: string
  content: string
  isStreaming: boolean
}

interface LoadedPlan {
  planId: string
  blueprint: ExecutionBlueprint
  validation?: ValidationResult | undefined
}

export function ChatRoute() {
  const { conversationId } = useParams<{ conversationId: string }>()
  const { settings, planningProgress, setPlanningProgress, setPlanningError, executionRunId } = useAppStore()
  const [messages, setMessages] = useState<Message[]>([])
  const [blueprints, setBlueprints] = useState<LoadedPlan[]>([])
  const [streaming, setStreaming] = useState<StreamingMessage | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  // Auto-scroll
  const scrollToBottom = useCallback((behavior: ScrollBehavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior })
    setShowScrollBtn(false)
    userScrolledRef.current = false
  }, [])

  // Load messages when conversation changes
  useEffect(() => {
    if (!conversationId) return

    setIsLoading(true)
    setError(null)
    setStreaming(null)
    setIsGenerating(false)
    userScrolledRef.current = false

    // Load messages
    apiClient
      .get<Message[]>(`/conversations/${conversationId}/messages`)
      .then((msgs) => {
        setMessages(msgs)
        setIsLoading(false)
        setTimeout(() => scrollToBottom('instant'), 50)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load messages')
        setIsLoading(false)
      })

    // Load existing plans for this conversation
    apiClient
      .get<Array<{ id: string }>>(`/conversations/${conversationId}/plans`)
      .then(async (planSummaries) => {
        if (Array.isArray(planSummaries) && planSummaries.length > 0) {
          const loaded = await Promise.all(
            planSummaries.map((p) =>
              apiClient.get<{ executionBlueprint: ExecutionBlueprint; validationResult?: ValidationResult }>(`/plans/${p.id}`)
            )
          )
          setBlueprints(
            loaded.map((item, idx) => ({
              planId: planSummaries[idx]?.id ?? item.executionBlueprint.id,
              blueprint: item.executionBlueprint,
              validation: item.validationResult,
            }))
          )
        } else {
          setBlueprints([])
        }
      })
      .catch(() => setBlueprints([]))
  }, [conversationId, scrollToBottom])

  const handleScroll = useCallback(() => {
    const el = scrollAreaRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    const isNearBottom = distFromBottom < 120
    userScrolledRef.current = !isNearBottom
    setShowScrollBtn(!isNearBottom && (messages.length > 0 || blueprints.length > 0))
  }, [messages.length, blueprints.length])

  // Auto-scroll during streaming, planning, or execution
  useEffect(() => {
    if ((streaming || planningProgress || executionRunId) && !userScrolledRef.current) {
      scrollToBottom('instant')
    }
  }, [streaming, planningProgress, executionRunId, scrollToBottom])

  // Subscribe to WebSocket events
  useEffect(() => {
    if (!conversationId) return

    const unsubs = [
      wsManager.on('message.started', (event) => {
        if (event.payload.conversationId !== conversationId) return
        setIsGenerating(true)
        setStreaming({ id: event.payload.messageId, content: '', isStreaming: true })
      }),

      wsManager.on('message.chunk', (event) => {
        if (event.payload.conversationId !== conversationId) return
        setStreaming((prev) =>
          prev ? { ...prev, content: prev.content + event.payload.token } : null
        )
      }),

      wsManager.on('message.finished', async (event) => {
        if (event.payload.conversationId !== conversationId) return
        setIsGenerating(false)
        setStreaming(null)
        // Reload messages to get the persisted version
        const updated = await apiClient.get<Message[]>(`/conversations/${conversationId}/messages`)
        setMessages(updated)
        setTimeout(() => scrollToBottom(), 50)

        // Update conversations list
        const all = await apiClient.get<ConversationSummary[]>('/conversations')
        useAppStore.getState().setConversations(all)
      }),

      wsManager.on('message.error', (event) => {
        if (event.payload.conversationId !== conversationId) return
        setIsGenerating(false)
        setStreaming(null)
        if (event.payload.code !== 'CANCELLED') {
          setError(event.payload.message)
        }
      }),

      // Planner event listeners
      wsManager.on('plan.progress', (event) => {
        setPlanningProgress({
          stage: event.payload.stage as PlanningStage,
          message: event.payload.message,
          progressPct: event.payload.progressPct,
        })
        setTimeout(() => scrollToBottom(), 50)
      }),

      wsManager.on('plan.ready', (event) => {
        setPlanningProgress(null)
        setBlueprints((prev) => [
          ...prev,
          {
            planId: event.payload.planId,
            blueprint: event.payload.blueprint as ExecutionBlueprint,
            validation: event.payload.validation as ValidationResult | undefined,
          },
        ])
        setTimeout(() => scrollToBottom(), 50)
      }),

      wsManager.on('plan.error', (event) => {
        setPlanningProgress(null)
        setPlanningError(event.payload.message)
        setError(`Planning failed: ${event.payload.message}`)
      }),
    ]

    return () => unsubs.forEach((u) => u())
  }, [conversationId, scrollToBottom, setPlanningProgress, setPlanningError])

  const handleSend = useCallback(
    (content: string) => {
      if (!conversationId || !content.trim() || isGenerating) return

      // Optimistically add user message
      const optimisticMsg: Message = {
        id: generateId(),
        conversationId,
        role: 'user',
        content,
        metadata: null,
        attachments: null,
        toolCalls: null,
        toolResults: null,
        status: 'complete',
        createdAt: Date.now(),
        deletedAt: null,
      }
      setMessages((prev) => [...prev, optimisticMsg])
      setTimeout(() => scrollToBottom(), 50)

      wsManager.send({
        type: 'message.send',
        payload: {
          conversationId,
          content,
          model: settings?.defaultModel ?? undefined,
          temperature: settings?.temperature !== undefined ? Number(settings.temperature) : undefined,
          maxTokens: settings?.maxTokens ?? undefined,
        },
      })
    },
    [conversationId, isGenerating, settings, scrollToBottom]
  )

  const handleStop = useCallback(() => {
    if (!conversationId) return
    wsManager.send({ type: 'message.stop', payload: { conversationId } })
  }, [conversationId])

  if (isLoading) {
    return (
      <div className="chat-loading">
        <Spinner size="md" />
      </div>
    )
  }

  const allMessages = messages.filter((m) => m.status !== 'error')

  return (
    <div className="chat-route">
      {/* Message area */}
      <div
        ref={scrollAreaRef}
        className="chat-scroll-area"
        onScroll={handleScroll}
      >
        {allMessages.length === 0 && !streaming && !planningProgress && blueprints.length === 0 ? (
          <EmptyState onPromptSelect={handleSend} />
        ) : (
          <div className="chat-messages">
            {allMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}

            {/* In-flight planning progress */}
            {planningProgress && (
              <PlanningProgress
                stage={planningProgress.stage}
                message={planningProgress.message}
                progressPct={planningProgress.progressPct}
              />
            )}

            {/* Generated execution blueprints */}
            {blueprints.map((item, idx) => (
              <PlanCard
                key={item.blueprint.id || idx}
                planId={item.planId}
                blueprint={item.blueprint}
                validation={item.validation}
              />
            ))}

            {/* Production Execution Panel */}
            {executionRunId && <ExecutionPanel />}

            {/* Streaming assistant message */}
            {streaming && (
              <MessageBubble
                message={{
                  id: streaming.id,
                  conversationId: conversationId ?? '',
                  role: 'assistant',
                  content: streaming.content,
                  metadata: null,
                  attachments: null,
                  toolCalls: null,
                  toolResults: null,
                  status: 'streaming',
                  createdAt: Date.now(),
                  deletedAt: null,
                }}
                isStreaming
              />
            )}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <button className="chat-scroll-btn" onClick={() => scrollToBottom()} aria-label="Scroll to bottom">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </button>
      )}

      {/* Error banner */}
      {error && (
        <div className="chat-error-banner">
          <span>{error}</span>
          <button onClick={() => setError(null)} aria-label="Dismiss">×</button>
        </div>
      )}

      {/* Input area */}
      <ChatInput
        onSend={handleSend}
        onStop={handleStop}
        isGenerating={isGenerating}
        disabled={!conversationId}
      />
    </div>
  )
}
