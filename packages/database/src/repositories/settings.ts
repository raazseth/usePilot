import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { toTimestamp } from '@usepilot/utils'

import * as schema from '../schema'
import type { SettingsRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface UpdateSettingsInput {
  theme?: SettingsRow['theme']
  activeProviderId?: string | null
  activeProviderType?: SettingsRow['activeProviderType']
  defaultModel?: string | null
  streamingEnabled?: boolean
  temperature?: string
  maxTokens?: number | null
  storagePath?: string | null
  featureFlags?: Record<string, boolean>
}

/**
 * Settings repository — singleton row pattern.
 * The settings table always has exactly one row with id = 'default'.
 */
export class SettingsRepository {
  constructor(private readonly db: DB) {}

  async get(): Promise<SettingsRow | null> {
    const result = await this.db
      .select()
      .from(schema.settings)
      .where(eq(schema.settings.id, 'default'))
      .limit(1)
    return result[0] ?? null
  }

  async upsert(input: UpdateSettingsInput): Promise<SettingsRow> {
    const now = toTimestamp()
    const existing = await this.get()

    if (existing) {
      await this.db
        .update(schema.settings)
        .set({
          ...input,
          featureFlags: input.featureFlags ? JSON.stringify(input.featureFlags) : undefined,
          updatedAt: now,
        })
        .where(eq(schema.settings.id, 'default'))
    } else {
      await this.db.insert(schema.settings).values({
        id: 'default',
        theme: input.theme ?? 'dark',
        activeProviderId: input.activeProviderId ?? null,
        activeProviderType: input.activeProviderType ?? null,
        defaultModel: input.defaultModel ?? null,
        streamingEnabled: input.streamingEnabled ?? true,
        temperature: input.temperature ?? '0.7',
        maxTokens: input.maxTokens ?? null,
        storagePath: input.storagePath ?? null,
        featureFlags: JSON.stringify(input.featureFlags ?? {}),
        updatedAt: now,
      })
    }

    const result = await this.get()
    if (!result) throw new Error('Failed to upsert settings')
    return result
  }
}
