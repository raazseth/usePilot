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

  /**
   * Emit a domain event. All handlers run concurrently.
   */
  async emit<T extends DomainEventType>(type: T, payload: DomainEventMap[T]): Promise<void> {
    const handlers = this.listeners.get(type)
    if (!handlers || handlers.size === 0) return

    await Promise.allSettled(
      Array.from(handlers).map((handler) => handler(payload as DomainEventMap[DomainEventType]))
    )
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
