import { Database } from 'bun:sqlite'
import { drizzle } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'
import * as schema from './schema'

/**
 * Seed the database with default data.
 * Safe to run multiple times — uses INSERT OR IGNORE.
 */
export async function seed(dbPath: string): Promise<void> {
  const sqlite = new Database(dbPath)
  const db = drizzle(sqlite, { schema })

  console.info('[seed] Seeding default data...')

  // Default Ollama provider
  await db
    .insert(schema.providers)
    .values({
      id: 'provider-ollama-default',
      name: 'Ollama',
      type: 'ollama',
      baseUrl: 'http://localhost:11434',
      isEnabled: true,
      isDefault: true,
      createdAt: toTimestamp(),
      updatedAt: toTimestamp(),
    })
    .onConflictDoNothing()

  // Default settings
  await db
    .insert(schema.settings)
    .values({
      id: 'default',
      theme: 'dark',
      activeProviderId: 'provider-ollama-default',
      activeProviderType: 'ollama',
      defaultModel: 'qwen2.5-coder:3b',
      streamingEnabled: true,
      temperature: '0.7',
      maxTokens: null,
      featureFlags: '{}',
      updatedAt: toTimestamp(),
    })
    .onConflictDoNothing()

  // Welcome conversation
  const conversationId = generateId()
  await db
    .insert(schema.conversations)
    .values({
      id: conversationId,
      title: 'Welcome to usePilot',
      providerId: 'provider-ollama-default',
      model: 'qwen2.5-coder:3b',
      createdAt: toTimestamp(),
      updatedAt: toTimestamp(),
    })
    .onConflictDoNothing()

  await db
    .insert(schema.messages)
    .values({
      id: generateId(),
      conversationId,
      role: 'assistant',
      content:
        "Hello! I'm usePilot, your local AI assistant. I'm powered by your local AI model and everything stays on your device. How can I help you today?",
      status: 'complete',
      createdAt: toTimestamp(),
    })
    .onConflictDoNothing()

  console.info('[seed] Done.')
  sqlite.close()
}

if (typeof import.meta !== 'undefined' && 'main' in import.meta && (import.meta as { main: boolean }).main) {
  const dbPath = process.env['DATABASE_PATH'] ?? './usepilot.db'
  await seed(dbPath)
}
