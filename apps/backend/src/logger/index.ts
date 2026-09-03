// ─────────────────────────────────────────────────────────────────────────────
// Structured Logger
// Every log entry carries: level, message, timestamp, and contextual fields.
// Never logs sensitive data (API keys, conversation content in prod).
// ─────────────────────────────────────────────────────────────────────────────

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface LogContext {
  requestId?: string | undefined
  conversationId?: string | undefined
  messageId?: string | undefined
  provider?: string | undefined
  model?: string | undefined
  latencyMs?: number | undefined
  durationMs?: number | undefined
  err?: Error | unknown
  [key: string]: unknown
}

export interface Logger {
  debug(context: LogContext | string, message?: string): void
  info(context: LogContext | string, message?: string): void
  warn(context: LogContext | string, message?: string): void
  error(context: LogContext | string, message?: string): void
  child(bindings: LogContext): Logger
}

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

class StructuredLogger implements Logger {
  private readonly minLevel: number
  private readonly namespace: string
  private readonly baseContext: LogContext

  constructor(namespace: string, level: LogLevel = 'info', context: LogContext = {}) {
    this.namespace = namespace
    this.minLevel = LEVELS[level]
    this.baseContext = context
  }

  debug(context: LogContext | string, message?: string) {
    this.log('debug', context, message)
  }

  info(context: LogContext | string, message?: string) {
    this.log('info', context, message)
  }

  warn(context: LogContext | string, message?: string) {
    this.log('warn', context, message)
  }

  error(context: LogContext | string, message?: string) {
    this.log('error', context, message)
  }

  child(bindings: LogContext): Logger {
    return new StructuredLogger(this.namespace, this.getLevelName(), {
      ...this.baseContext,
      ...bindings,
    })
  }

  private log(level: LogLevel, context: LogContext | string, message?: string) {
    if (LEVELS[level] < this.minLevel) return

    const [ctx, msg] =
      typeof context === 'string'
        ? [{}, context]
        : [context, message ?? '']

    const entry = {
      level,
      ts: new Date().toISOString(),
      ns: this.namespace,
      msg,
      ...this.baseContext,
      ...ctx,
    }

    // Format error objects for readability
    if (entry.err instanceof Error) {
      entry.err = {
        message: entry.err.message,
        name: entry.err.name,
        stack: process.env['NODE_ENV'] !== 'production' ? entry.err.stack : undefined,
      }
    }

    const output = JSON.stringify(entry)

    if (level === 'error' || level === 'warn') {
      process.stderr.write(output + '\n')
    } else {
      process.stdout.write(output + '\n')
    }
  }

  private getLevelName(): LogLevel {
    const entry = Object.entries(LEVELS).find(([, v]) => v === this.minLevel)
    return (entry?.[0] ?? 'info') as LogLevel
  }
}

// Global log level from environment
const globalLevel = (process.env['LOG_LEVEL'] ?? 'info') as LogLevel

export function createLogger(namespace: string, context?: LogContext): Logger {
  return new StructuredLogger(namespace, globalLevel, context)
}
