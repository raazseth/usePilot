import { z } from 'zod'

export const DatabaseConfigSchema = z.object({
  /** SQLite filename — relative to app data dir */
  filename: z.string().default('usepilot.db'),
  /** WAL mode for better concurrent read performance */
  walMode: z.boolean().default(true),
  /** Foreign key enforcement */
  foreignKeys: z.boolean().default(true),
  /** Busy timeout in ms (when DB is locked) */
  busyTimeoutMs: z.number().int().default(5_000),
})

export type DatabaseConfig = z.infer<typeof DatabaseConfigSchema>

export const databaseConfig: DatabaseConfig = DatabaseConfigSchema.parse({})
