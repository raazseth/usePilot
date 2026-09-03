import type { RouteHandler } from '../router'
import { json, errorResponse } from '../router'
import type { SettingsRepository, ConversationRepository, MessageRepository, ProviderRepository } from '@usepilot/database'
import type { EventBus } from '../../../events/bus'
import type { Logger } from '../../../logger'

type Repos = {
  conversations: ConversationRepository
  messages: MessageRepository
  settings: SettingsRepository
  providers: ProviderRepository
}

export function settingsRouter(
  repos: Repos,
  eventBus: EventBus,
  logger: Logger
): RouteHandler {
  return async (req, url) => {
    const path = url.pathname

    // GET /settings
    if (req.method === 'GET' && path === '/settings') {
      const settings = await repos.settings.get()
      return json(settings)
    }

    // PATCH /settings
    if (req.method === 'PATCH' && path === '/settings') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const updated = await repos.settings.upsert(body as Parameters<typeof repos.settings.upsert>[0])

      for (const [key, value] of Object.entries(body)) {
        await eventBus.emit('settings.updated', { key, value })
      }

      logger.info({ keys: Object.keys(body) }, 'Settings updated')
      return json(updated)
    }

    return null
  }
}
