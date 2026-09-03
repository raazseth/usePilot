import { createLogger } from './logger'
import { loadConfig } from './config/app'
import { initializeDatabase } from './infrastructure/database/client'
import { createRouter } from './infrastructure/http/router'
import { WebSocketHandler } from './infrastructure/websocket/handler'
import { ProviderManager } from './infrastructure/ai/provider-manager'
import { EventBus } from './events/bus'
import { migrate } from '@usepilot/database'
import { seed } from '@usepilot/database'
import { join } from 'path'

const logger = createLogger('bootstrap')

async function bootstrap() {
  logger.info('Starting usePilot backend...')

  // Load and validate all configuration
  const config = loadConfig()
  logger.info({ port: config.port, env: config.nodeEnv }, 'Configuration loaded')

  // Run database migrations
  const dbPath = join(config.dataDir, 'usepilot.db')
  logger.info({ dbPath }, 'Running database migrations...')
  await migrate(dbPath)
  await seed(dbPath)

  // Initialize database connection
  const db = initializeDatabase(dbPath)
  logger.info('Database initialized')

  // Initialize event bus
  const eventBus = new EventBus()

  // Initialize AI provider manager
  const providerManager = new ProviderManager(db, eventBus, logger)
  await providerManager.initialize()

  // Create WebSocket handler
  const wsHandler = new WebSocketHandler(db, providerManager, eventBus, logger)

  // Create HTTP router
  const router = createRouter(db, providerManager, eventBus, logger)

  // Start the server on a dynamic port
  const server = Bun.serve({
    port: config.port,
    fetch: router.fetch,
    websocket: wsHandler.handlers,
    error(error) {
      logger.error({ err: error }, 'Server error')
    },
  })

  const actualPort = server.port
  logger.info({ port: actualPort }, 'Server started')

  // Signal readiness to the parent Tauri process via stdout
  // The Tauri sidecar wrapper reads this to know the backend is ready
  process.stdout.write(`BACKEND_PORT=${actualPort}\n`)

  // Handle graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...')
    server.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

bootstrap().catch((error) => {
  console.error('[FATAL] Bootstrap failed:', error)
  process.exit(1)
})
