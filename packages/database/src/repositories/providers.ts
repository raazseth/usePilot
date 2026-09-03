import { eq } from 'drizzle-orm'
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite'
import { generateId, toTimestamp } from '@usepilot/utils'

import * as schema from '../schema'
import type { ProviderRow, NewProviderRow } from '../schema'

type DB = BunSQLiteDatabase<typeof schema>

export interface CreateProviderInput {
  name: string
  type: ProviderRow['type']
  baseUrl: string
  isDefault?: boolean | undefined
}

/**
 * Provider repository — manages AI provider configurations.
 * Ensures only one provider can be the default at a time.
 */
export class ProviderRepository {
  constructor(private readonly db: DB) {}

  async create(input: CreateProviderInput): Promise<ProviderRow> {
    if (input.isDefault) {
      await this.clearDefault()
    }

    const now = toTimestamp()
    const row: NewProviderRow = {
      id: generateId(),
      name: input.name,
      type: input.type,
      baseUrl: input.baseUrl,
      isEnabled: true,
      isDefault: input.isDefault ?? false,
      createdAt: now,
      updatedAt: now,
    }
    await this.db.insert(schema.providers).values(row)
    return row as ProviderRow
  }

  async findById(id: string): Promise<ProviderRow | null> {
    const result = await this.db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.id, id))
      .limit(1)
    return result[0] ?? null
  }

  async findDefault(): Promise<ProviderRow | null> {
    const result = await this.db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.isDefault, true))
      .limit(1)
    return result[0] ?? null
  }

  async listAll(): Promise<ProviderRow[]> {
    return this.db.select().from(schema.providers).orderBy(schema.providers.createdAt)
  }

  async listEnabled(): Promise<ProviderRow[]> {
    return this.db
      .select()
      .from(schema.providers)
      .where(eq(schema.providers.isEnabled, true))
      .orderBy(schema.providers.createdAt)
  }

  async setDefault(id: string): Promise<void> {
    await this.clearDefault()
    await this.db
      .update(schema.providers)
      .set({ isDefault: true, updatedAt: toTimestamp() })
      .where(eq(schema.providers.id, id))
  }

  async delete(id: string): Promise<boolean> {
    await this.db
      .delete(schema.providers)
      .where(eq(schema.providers.id, id))
    return true
  }

  private async clearDefault(): Promise<void> {
    await this.db
      .update(schema.providers)
      .set({ isDefault: false, updatedAt: toTimestamp() })
      .where(eq(schema.providers.isDefault, true))
  }
}
