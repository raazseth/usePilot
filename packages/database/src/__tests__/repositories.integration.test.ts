import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { tmpdir } from 'os'
import { unlinkSync, existsSync } from 'fs'
import { generateId } from '@usepilot/utils'
import { createDatabase } from '../client'
import { migrate } from '../migrate'
import { seed } from '../seed'
import { ConversationRepository } from '../repositories/conversations'
import { MessageRepository } from '../repositories/messages'
import { SettingsRepository } from '../repositories/settings'
import { ProviderRepository } from '../repositories/providers'

describe('Database Repositories Integration Tests', () => {
  const testDbPath = join(tmpdir(), `usepilot-test-${generateId()}.db`)
  let db: ReturnType<typeof createDatabase>
  let convRepo: ConversationRepository
  let msgRepo: MessageRepository
  let settingsRepo: SettingsRepository
  let providerRepo: ProviderRepository

  beforeEach(async () => {
    // Run real migrations and seed on an isolated SQLite database
    await migrate(testDbPath)
    await seed(testDbPath)
    db = createDatabase(testDbPath)
    convRepo = new ConversationRepository(db)
    msgRepo = new MessageRepository(db)
    settingsRepo = new SettingsRepository(db)
    providerRepo = new ProviderRepository(db)
  })

  afterEach(() => {
    try {
      if (existsSync(testDbPath)) unlinkSync(testDbPath)
      if (existsSync(`${testDbPath}-wal`)) unlinkSync(`${testDbPath}-wal`)
      if (existsSync(`${testDbPath}-shm`)) unlinkSync(`${testDbPath}-shm`)
    } catch {
      // Cleanup best effort
    }
  })

  describe('ConversationRepository', () => {
    it('creates, retrieves, and searches conversations', async () => {
      const conv = await convRepo.create({
        title: 'Quantum Computing Discussion',
        model: 'llama3.2',
      })
      expect(conv.id).toBeDefined()
      expect(conv.title).toBe('Quantum Computing Discussion')

      const found = await convRepo.findById(conv.id)
      expect(found).not.toBeNull()
      expect(found?.title).toBe('Quantum Computing Discussion')

      // Search
      const searchResults = await convRepo.search('Quantum')
      expect(searchResults.length).toBeGreaterThanOrEqual(1)
      expect(searchResults[0]?.id).toBe(conv.id)

      // Soft delete
      const deleted = await convRepo.softDelete(conv.id)
      expect(deleted).toBe(true)

      const afterDelete = await convRepo.findById(conv.id)
      expect(afterDelete).toBeNull()
    })
  })

  describe('MessageRepository', () => {
    it('stores messages and preserves conversation timeline', async () => {
      const conv = await convRepo.create({ title: 'Test Chat' })

      const msg1 = await msgRepo.create({
        conversationId: conv.id,
        role: 'user',
        content: 'Hello AI!',
      })
      expect(msg1.role).toBe('user')
      expect(msg1.content).toBe('Hello AI!')

      const msg2 = await msgRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: 'Hello Human! How can I help?',
      })

      const allMessages = await msgRepo.findByConversationId(conv.id)
      expect(allMessages.length).toBe(2)
      expect(allMessages[0]?.content).toBe('Hello AI!')
      expect(allMessages[1]?.content).toBe('Hello Human! How can I help?')

      // Updating metadata and status
      const updated = await msgRepo.update(msg2.id, {
        status: 'complete',
        metadata: {
          model: 'llama3.2',
          finishReason: 'stop',
          provider: 'ollama',
          generationDurationMs: 450,
        },
      })
      expect(updated?.status).toBe('complete')
      const parsedMeta = JSON.parse(updated?.metadata ?? '{}')
      expect(parsedMeta.model).toBe('llama3.2')
      expect(parsedMeta.finishReason).toBe('stop')
    })

    it('cancels pending and streaming messages', async () => {
      const conv = await convRepo.create({ title: 'Cancel Test' })
      const msg = await msgRepo.create({
        conversationId: conv.id,
        role: 'assistant',
        content: 'Halfway through...',
      })

      await msgRepo.update(msg.id, { status: 'streaming' })
      await msgRepo.cancelStreamingMessages(conv.id)

      const cancelled = await msgRepo.findById(msg.id)
      expect(cancelled?.status).toBe('cancelled')
    })
  })

  describe('SettingsRepository', () => {
    it('initializes default settings and updates fields', async () => {
      const settings = await settingsRepo.get()
      expect(settings).not.toBeNull()
      expect(settings?.theme).toBe('dark')

      const updated = await settingsRepo.upsert({
        theme: 'light',
        defaultModel: 'qwen2.5',
      })
      expect(updated.theme).toBe('light')
      expect(updated.defaultModel).toBe('qwen2.5')

      // Reload verifies persistence
      const reloaded = await settingsRepo.get()
      expect(reloaded?.theme).toBe('light')
      expect(reloaded?.defaultModel).toBe('qwen2.5')
    })
  })

  describe('ProviderRepository', () => {
    it('manages active and default providers', async () => {
      const p1 = await providerRepo.create({
        name: 'Local Ollama Custom',
        type: 'ollama',
        baseUrl: 'http://localhost:11434',
        isDefault: true,
      })
      expect(p1.isDefault).toBe(true)

      const p2 = await providerRepo.create({
        name: 'LM Studio Local',
        type: 'lmstudio',
        baseUrl: 'http://localhost:1234',
      })
      expect(p2.isDefault).toBe(false)

      // Set p2 as default -> p1 should no longer be default
      await providerRepo.setDefault(p2.id)

      const all = await providerRepo.listAll()
      const p1Updated = all.find((p) => p.id === p1.id)
      const p2Updated = all.find((p) => p.id === p2.id)

      expect(p1Updated?.isDefault).toBe(false)
      expect(p2Updated?.isDefault).toBe(true)
    })
  })
})
