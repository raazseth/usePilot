import type { RouteHandler } from '../router'
import { json, errorResponse } from '../router'
import type { ConversationRepository, MessageRepository, SettingsRepository, ProviderRepository } from '@usepilot/database'
import type { ProviderManager } from '../../ai/provider-manager'
import type { EventBus } from '../../../events/bus'
import type { Logger } from '../../../logger'

type Repos = {
  conversations: ConversationRepository
  messages: MessageRepository
  settings: SettingsRepository
  providers: ProviderRepository
}

export function messagesRouter(
  repos: Repos,
  providerManager: ProviderManager,
  eventBus: EventBus,
  logger: Logger
): RouteHandler {
  return async (req, url) => {
    const path = url.pathname

    // GET /conversations/:id/messages
    const listMatch = path.match(/^\/conversations\/([^/]+)\/messages$/)
    if (listMatch && req.method === 'GET') {
      const [, conversationId] = listMatch
      if (!conversationId) return null
      const messages = await repos.messages.findByConversationId(conversationId)
      return json(messages)
    }

    // GET /providers/:id/models
    const modelsMatch = path.match(/^\/providers\/([^/]+)\/models$/)
    if (modelsMatch && req.method === 'GET') {
      const [, providerId] = modelsMatch
      if (!providerId) return null
      const provider = providerManager.get(providerId)
      if (!provider) return errorResponse('Provider not found', 404)
      try {
        const models = await provider.listModels()
        return json(models)
      } catch {
        return errorResponse('Failed to fetch models — provider may be offline', 503)
      }
    }

    return null
  }
}
