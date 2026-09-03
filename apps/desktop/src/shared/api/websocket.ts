import { generateId } from '@usepilot/utils'
import { appConfig } from '@usepilot/config'
import type { ClientEvent, ServerEvent, ServerEventType } from '@usepilot/types'

type Handler<T extends ServerEventType> = (
  event: Extract<ServerEvent, { type: T }>
) => void

type AnyHandler = (event: ServerEvent) => void

type Unsubscribe = () => void

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

/**
 * Reconnecting WebSocket manager implementing the unified AppEvent protocol.
 * Auto-reconnects with exponential backoff.
 * Event-based API — callers subscribe to specific event types.
 */
export class WebSocketManager {
  private ws: WebSocket | null = null
  private url: string | null = null
  private reconnectAttempt = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private readonly handlers = new Map<ServerEventType | '*', Set<AnyHandler>>()
  private readonly statusHandlers = new Set<(status: WebSocketStatus) => void>()
  private _status: WebSocketStatus = 'disconnected'
  private intentionalClose = false

  get status(): WebSocketStatus {
    return this._status
  }

  connect(wsUrl: string): void {
    this.url = wsUrl
    this.intentionalClose = false
    this._connect()
  }

  disconnect(): void {
    this.intentionalClose = true
    this._cleanup()
    this._setStatus('disconnected')
  }

  send(event: Omit<ClientEvent, 'id' | 'timestamp'>): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[WebSocket] Cannot send — not connected')
      return
    }
    const fullEvent: ClientEvent = {
      ...event,
      id: generateId(),
      timestamp: new Date().toISOString(),
    } as ClientEvent
    this.ws.send(JSON.stringify(fullEvent))
  }

  on<T extends ServerEventType>(type: T, handler: Handler<T>): Unsubscribe {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add(handler as AnyHandler)
    return () => this.handlers.get(type)?.delete(handler as AnyHandler)
  }

  onAny(handler: AnyHandler): Unsubscribe {
    if (!this.handlers.has('*')) {
      this.handlers.set('*', new Set())
    }
    this.handlers.get('*')!.add(handler)
    return () => this.handlers.get('*')?.delete(handler)
  }

  onStatusChange(handler: (status: WebSocketStatus) => void): Unsubscribe {
    this.statusHandlers.add(handler)
    return () => this.statusHandlers.delete(handler)
  }

  private _connect(): void {
    if (!this.url) return
    this._cleanup()
    this._setStatus('connecting')

    try {
      this.ws = new WebSocket(this.url)

      this.ws.onopen = () => {
        this.reconnectAttempt = 0
        this._setStatus('connected')
        this._startPing()
      }

      this.ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data as string) as ServerEvent
          this._dispatch(parsed)
        } catch {
          console.error('[WebSocket] Failed to parse message:', event.data)
        }
      }

      this.ws.onclose = () => {
        this._cleanup()
        if (!this.intentionalClose) {
          this._setStatus('disconnected')
          this._scheduleReconnect()
        }
      }

      this.ws.onerror = () => {
        this._setStatus('error')
      }
    } catch {
      this._setStatus('error')
      this._scheduleReconnect()
    }
  }

  private _dispatch(event: ServerEvent): void {
    // Dispatch to type-specific handlers
    const typeHandlers = this.handlers.get(event.type as ServerEventType)
    typeHandlers?.forEach((h) => h(event))

    // Dispatch to wildcard handlers
    const wildcardHandlers = this.handlers.get('*')
    wildcardHandlers?.forEach((h) => h(event))
  }

  private _scheduleReconnect(): void {
    if (this.intentionalClose) return

    const { reconnectMinMs, reconnectMaxMs, reconnectMaxAttempts } = appConfig.websocket

    if (this.reconnectAttempt >= reconnectMaxAttempts) {
      console.error('[WebSocket] Max reconnect attempts reached')
      return
    }

    const delay = Math.min(
      reconnectMinMs * Math.pow(2, this.reconnectAttempt),
      reconnectMaxMs
    )

    this.reconnectAttempt++
    this.reconnectTimer = setTimeout(() => this._connect(), delay)
  }

  private _startPing(): void {
    const { pingIntervalMs } = appConfig.websocket
    this.pingTimer = setInterval(() => {
      this.send({ type: 'health.ping', payload: {} } as Omit<ClientEvent, 'id' | 'timestamp'>)
    }, pingIntervalMs)
  }

  private _cleanup(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.pingTimer) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
    if (this.ws) {
      this.ws.onopen = null
      this.ws.onmessage = null
      this.ws.onclose = null
      this.ws.onerror = null
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close()
      }
      this.ws = null
    }
  }

  private _setStatus(status: WebSocketStatus): void {
    this._status = status
    this.statusHandlers.forEach((h) => h(status))
  }
}

/** Singleton WebSocket manager */
export const wsManager = new WebSocketManager()
