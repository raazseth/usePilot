import { z } from 'zod'

export const AppConfigSchema = z.object({
  name: z.string().default('usePilot'),
  version: z.string().default('0.1.0'),
  /** Minimum window dimensions */
  window: z.object({
    minWidth: z.number().int().default(900),
    minHeight: z.number().int().default(600),
    defaultWidth: z.number().int().default(1200),
    defaultHeight: z.number().int().default(800),
  }).default({}),
  /** WebSocket configuration */
  websocket: z.object({
    /** Auto-reconnect interval range */
    reconnectMinMs: z.number().int().default(1000),
    reconnectMaxMs: z.number().int().default(30_000),
    reconnectMaxAttempts: z.number().int().default(10),
    /** Heartbeat ping interval */
    pingIntervalMs: z.number().int().default(30_000),
    /** How long to wait for pong before considering connection dead */
    pongTimeoutMs: z.number().int().default(5_000),
  }).default({}),
  /** AI request configuration */
  ai: z.object({
    defaultTemperature: z.number().min(0).max(2).default(0.7),
    defaultMaxTokens: z.number().int().nullable().default(null),
    requestTimeoutMs: z.number().int().default(120_000),
  }).default({}),
})

export type AppConfig = z.infer<typeof AppConfigSchema>

/** Application-level configuration with defaults */
export const appConfig: AppConfig = AppConfigSchema.parse({})
