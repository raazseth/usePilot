import type { RouteHandler } from '../router'
import { json, errorResponse } from '../router'
import type { ConversationRepository } from '@usepilot/database'
import type { MessageRepository } from '@usepilot/database'
import type { SettingsRepository } from '@usepilot/database'
import type { ProviderRepository } from '@usepilot/database'
import type { EventBus } from '../../../events/bus'
import type { Logger } from '../../../logger'
import { generateId } from '@usepilot/utils'

type Repos = {
  conversations: ConversationRepository
  messages: MessageRepository
  settings: SettingsRepository
  providers: ProviderRepository
}

export function conversationsRouter(
  repos: Repos,
  eventBus: EventBus,
  logger: Logger
): RouteHandler {
  return async (req, url) => {
    const path = url.pathname

    // GET /conversations
    if (req.method === 'GET' && path === '/conversations') {
      const conversations = await repos.conversations.listAll()
      return json(conversations)
    }

    // POST /conversations
    if (req.method === 'POST' && path === '/conversations') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const conversation = await repos.conversations.create({
        title: (body['title'] as string) || 'New Conversation',
        providerId: body['providerId'] as string | undefined,
        model: body['model'] as string | undefined,
      })

      await eventBus.emit('conversation.created', { id: conversation.id, title: conversation.title })
      logger.info({ conversationId: conversation.id }, 'Conversation created')
      return json(conversation, 201)
    }

    // GET /conversations/search?q=...
    if (req.method === 'GET' && path === '/conversations/search') {
      const q = url.searchParams.get('q') ?? ''
      const results = await repos.conversations.search(q)
      return json(results)
    }

    // Match /conversations/:id
    const match = path.match(/^\/conversations\/([^/]+)$/)
    if (!match) return null
    const [, id] = match
    if (!id) return null

    // GET /conversations/:id
    if (req.method === 'GET') {
      const conversation = await repos.conversations.findById(id)
      if (!conversation) return errorResponse('Conversation not found', 404)
      return json(conversation)
    }

    // PATCH /conversations/:id
    if (req.method === 'PATCH') {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
      const updated = await repos.conversations.update(id, {
        title: body['title'] as string | undefined,
      })
      if (!updated) return errorResponse('Conversation not found', 404)

      if (body['title']) {
        await eventBus.emit('conversation.renamed', { id, title: body['title'] as string })
      }
      return json(updated)
    }

    // DELETE /conversations/:id
    if (req.method === 'DELETE') {
      const deleted = await repos.conversations.softDelete(id)
      if (!deleted) return errorResponse('Conversation not found', 404)
      await eventBus.emit('conversation.deleted', { id })
      return json({ success: true })
    }

    return null
  }
}
