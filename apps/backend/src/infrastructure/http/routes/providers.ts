import type { RouteHandler } from '../router'
import { json, errorResponse } from '../router'
import type { ProviderRepository, ConversationRepository, MessageRepository, SettingsRepository } from '@usepilot/database'
import type { ProviderManager } from '../../ai/provider-manager'
import type { EventBus } from '../../../events/bus'
import type { Logger } from '../../../logger'

type Repos = {
  conversations: ConversationRepository
  messages: MessageRepository
  settings: SettingsRepository
  providers: ProviderRepository
}

export function providersRouter(
  repos: Repos,
  providerManager: ProviderManager,
  eventBus: EventBus,
  logger: Logger
): RouteHandler {
  return async (req, url) => {
    const path = url.pathname

    // GET /providers
    if (req.method === 'GET' && path === '/providers') {
      const providers = await repos.providers.listAll()
      const list = providerManager.listAll()

      // Enrich with runtime status
      const enriched = providers.map((p) => ({
        ...p,
        isActive: list.some((l) => l.id === p.id && l.provider === providerManager.getActive()),
      }))
      return json(enriched)
    }

    // GET /providers/models
    if (req.method === 'GET' && path === '/providers/models') {
      const active = providerManager.getActive()
      if (!active) return json([])
      try {
        const models = await active.listModels()
        return json(models)
      } catch (err) {
        logger.warn({ err }, 'Failed to fetch provider models')
        return json([])
      }
    }

    // POST /providers
    if (req.method === 'POST' && path === '/providers') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      if (!body['name'] || !body['type'] || !body['baseUrl']) {
        return errorResponse('name, type, and baseUrl are required')
      }
      const provider = await repos.providers.create({
        name: body['name'] as string,
        type: body['type'] as 'ollama' | 'lmstudio' | 'openai-compatible',
        baseUrl: body['baseUrl'] as string,
        isDefault: body['isDefault'] as boolean | undefined,
      })
      return json(provider, 201)
    }

    // POST /providers/:id/activate
    const activateMatch = path.match(/^\/providers\/([^/]+)\/activate$/)
    if (activateMatch && req.method === 'POST') {
      const [, id] = activateMatch
      if (!id) return null
      try {
        await providerManager.setActive(id)
        return json({ success: true })
      } catch {
        return errorResponse('Provider not found', 404)
      }
    }

    // GET /providers/:id/health
    const healthMatch = path.match(/^\/providers\/([^/]+)\/health$/)
    if (healthMatch && req.method === 'GET') {
      const [, id] = healthMatch
      if (!id) return null
      const provider = providerManager.get(id)
      if (!provider) return errorResponse('Provider not found', 404)
      const health = await provider.healthCheck()
      return json(health)
    }

    // DELETE /providers/:id
    const deleteMatch = path.match(/^\/providers\/([^/]+)$/)
    if (deleteMatch && req.method === 'DELETE') {
      const [, id] = deleteMatch
      if (!id) return null
      const deleted = await repos.providers.delete(id)
      if (!deleted) return errorResponse('Provider not found', 404)
      return json({ success: true })
    }

    return null
  }
}
