import { generateId } from '@usepilot/utils'
import {
  ConversationRepository,
  MessageRepository,
  SettingsRepository,
  ProviderRepository,
  PlanRepository,
  PlannerRunRepository,
} from '@usepilot/database'
import type { Logger } from '../../logger'
import type { EventBus } from '../../events/bus'
import type { ProviderManager } from '../ai/provider-manager'
import { conversationsRouter } from './routes/conversations'
import { messagesRouter } from './routes/messages'
import { providersRouter } from './routes/providers'
import { settingsRouter } from './routes/settings'
import { healthRouter } from './routes/health'
import { plannerRouter } from './routes/planner'

type DB = ReturnType<typeof import('@usepilot/database').createDatabase>

// CORS headers for dev (Tauri WebView is same-origin in prod)
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

/**
 * Create the main HTTP router.
 * Route handlers are thin — they parse input, call application layer, return response.
 * No business logic lives here.
 */
export function createRouter(
  db: DB,
  providerManager: ProviderManager,
  eventBus: EventBus,
  logger: Logger
) {
  // Initialize repositories
  const repos = {
    conversations: new ConversationRepository(db),
    messages: new MessageRepository(db),
    settings: new SettingsRepository(db),
    providers: new ProviderRepository(db),
    plans: new PlanRepository(db),
    runs: new PlannerRunRepository(db),
  }

  // Planner router (different interface — handle(req, pathname))
  const plannerRoutes = plannerRouter({ plans: repos.plans, runs: repos.runs })

  const routes = [
    healthRouter(providerManager),
    conversationsRouter(repos, eventBus, logger),
    messagesRouter(repos, providerManager, eventBus, logger),
    providersRouter(repos, providerManager, eventBus, logger),
    settingsRouter(repos, eventBus, logger),
    // Planner routes adapter
    async (req: Request, url: URL) => plannerRoutes.handle(req, url.pathname),
  ]

  return {
    fetch: async (req: Request, server: import('bun').Server<unknown>): Promise<Response> => {
      const requestId = generateId()
      const start = Date.now()
      const url = new URL(req.url)

      // Handle CORS preflight
      if (req.method === 'OPTIONS') {
        return new Response(null, { status: 204, headers: CORS_HEADERS })
      }

      // Handle WebSocket upgrade
      if (req.headers.get('upgrade') === 'websocket') {
        const success = server.upgrade(req, { data: { requestId } })
        return success
          ? new Response()
          : new Response('WebSocket upgrade failed', { status: 500 })
      }

      const childLogger = logger.child({ requestId, method: req.method, path: url.pathname })

      try {
        // Try each route handler
        for (const route of routes) {
          const response = await route(req, url)
          if (response !== null) {
            const latencyMs = Date.now() - start
            childLogger.info({ latencyMs, status: response.status }, 'Request completed')

            // Attach CORS and request ID headers
            const headers = new Headers(response.headers)
            Object.entries(CORS_HEADERS).forEach(([k, v]) => headers.set(k, v))
            headers.set('X-Request-Id', requestId)

            return new Response(response.body, {
              status: response.status,
              headers,
            })
          }
        }

        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      } catch (error) {
        const latencyMs = Date.now() - start
        childLogger.error({ err: error, latencyMs }, 'Request failed')
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
          status: 500,
          headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
        })
      }
    },
  }
}

/** Helper to create a JSON response */
export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** Helper to create an error response */
export function errorResponse(message: string, status = 400): Response {
  return json({ error: message }, status)
}

export type RouteHandler = (req: Request, url: URL) => Promise<Response | null>
