import { z } from 'zod'

export const EnvironmentSchema = z.object({
  /** Runtime environment */
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  /** Backend WebSocket/HTTP port — 0 means dynamically assigned */
  BACKEND_PORT: z.coerce.number().int().min(0).max(65535).default(0),
  /** Log level */
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  /** Application data directory override (optional) */
  APP_DATA_DIR: z.string().optional(),
})

export type Environment = z.infer<typeof EnvironmentSchema>

/**
 * Parse and validate environment variables.
 * Falls back to defaults for all optional fields.
 * Throws if required fields are missing or invalid.
 */
function parseEnvironment(): Environment {
  const result = EnvironmentSchema.safeParse({
    NODE_ENV: process.env['NODE_ENV'],
    BACKEND_PORT: process.env['BACKEND_PORT'],
    LOG_LEVEL: process.env['LOG_LEVEL'],
    APP_DATA_DIR: process.env['APP_DATA_DIR'],
  })

  if (!result.success) {
    throw new Error(
      `Invalid environment configuration:\n${result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n')}`
    )
  }

  return result.data
}

/** Validated environment configuration — parsed once at startup */
export const environmentConfig = parseEnvironment()
