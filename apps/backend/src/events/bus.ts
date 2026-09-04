// ─────────────────────────────────────────────────────────────────────────────
// Internal Event Bus
// Typed publish/subscribe — enables decoupled communication between
// Domain, Application, and Infrastructure layers.
//
// Future phases (planner, execution engine) subscribe here without modifying
// existing code — open/closed principle.
// ─────────────────────────────────────────────────────────────────────────────

export type DomainEventMap = {
  // Conversation events
  'conversation.created': { id: string; title: string }
  'conversation.renamed': { id: string; title: string }
  'conversation.deleted': { id: string }

  // Message events
  'message.created': { id: string; conversationId: string; role: string }
  'message.streaming.started': { id: string; conversationId: string; model: string }
  'message.chunk.received': { id: string; conversationId: string; token: string; index: number }
  'message.streaming.finished': {
    id: string
    conversationId: string
    content: string
    usage?: { promptTokens: number; completionTokens: number; totalTokens: number } | undefined
  }
  'message.streaming.cancelled': { id: string; conversationId: string }
  'message.error': { id: string; conversationId: string; error: Error }

  // Provider events
  'provider.registered': { id: string; type: string; name: string }
  'provider.active.changed': { id: string; type: string; name: string }
  'provider.health.changed': { id: string; status: string }

  // Settings events
  'settings.updated': { key: string; value: unknown }

  // ── Phase 2: Planner events ───────────────────────────────────────────────
  // Four events only — stage is in the payload, not in the event type name.
  'planner.started':   { runId: string; goalId: string; conversationId: string }
  'planner.progress':  { runId: string; stage: string; progressPct: number; message: string }
  'planner.completed': { runId: string; blueprintId: string; taskCount: number; estimatedComplexity: string }
  'planner.failed':    { runId: string; errorCode: string; stage: string; retries: number; message: string }
}

export type DomainEventType = keyof DomainEventMap

type Handler<T extends DomainEventType> = (payload: DomainEventMap[T]) => void | Promise<void>

type Unsubscribe = () => void

/**
 * Typed in-process event bus.
 * Uses EventEmitter semantics but with full type safety.
 */
export class EventBus {
  private readonly listeners = new Map<DomainEventType, Set<Handler<DomainEventType>>>()

  /**
   * Subscribe to a domain event.
   * @returns Unsubscribe function
   */
  on<T extends DomainEventType>(type: T, handler: Handler<T>): Unsubscribe {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set())
    }
    const set = this.listeners.get(type)!
    set.add(handler as Handler<DomainEventType>)

    return () => {
      set.delete(handler as Handler<DomainEventType>)
    }
  }

  private readonly wildcardListeners = new Set<(event: { type: DomainEventType; payload: unknown }) => void | Promise<void>>()

  /**
   * Subscribe to all events.
   */
  onAny(handler: (event: { type: DomainEventType; payload: unknown }) => void | Promise<void>): Unsubscribe {
    this.wildcardListeners.add(handler)
    return () => {
      this.wildcardListeners.delete(handler)
    }
  }

  /**
   * Emit a domain event. All handlers run concurrently and errors are isolated.
   */
  async emit<T extends DomainEventType>(type: T, payload: DomainEventMap[T]): Promise<void> {
    const handlers = this.listeners.get(type)

    const promises: Promise<unknown>[] = []

    if (handlers && handlers.size > 0) {
      for (const handler of handlers) {
        promises.push(
          Promise.resolve().then(() => handler(payload as DomainEventMap[DomainEventType]))
        )
      }
    }

    if (this.wildcardListeners.size > 0) {
      for (const wildcard of this.wildcardListeners) {
        promises.push(
          Promise.resolve().then(() => wildcard({ type, payload }))
        )
      }
    }

    await Promise.allSettled(promises)
  }

  /**
   * Subscribe once — automatically unsubscribes after first event.
   */
  once<T extends DomainEventType>(type: T, handler: Handler<T>): Unsubscribe {
    const unsub = this.on(type, (payload) => {
      unsub()
      return handler(payload)
    })
    return unsub
  }

  /**
   * Remove all listeners for a specific event type.
   * Useful for testing.
   */
  removeAllListeners(type?: DomainEventType): void {
    if (type) {
      this.listeners.delete(type)
    } else {
      this.listeners.clear()
    }
  }
}
