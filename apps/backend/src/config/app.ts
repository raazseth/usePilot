import { join } from 'path'
import { homedir } from 'os'

export interface BackendConfig {
  nodeEnv: 'development' | 'production' | 'test'
  port: number
  dataDir: string
  logLevel: 'debug' | 'info' | 'warn' | 'error'
}

/**
 * Load backend configuration from environment variables.
 * All values have sensible defaults for local development.
 */
export function loadConfig(): BackendConfig {
  const nodeEnv = (process.env['NODE_ENV'] ?? 'development') as BackendConfig['nodeEnv']
  const port = parseInt(process.env['BACKEND_PORT'] ?? '0', 10)
  const logLevel = (process.env['LOG_LEVEL'] ?? 'info') as BackendConfig['logLevel']

  // Data directory: APP_DATA_DIR env → ~/.usepilot
  const dataDir =
    process.env['APP_DATA_DIR'] ??
    join(homedir(), '.usepilot')

  return { nodeEnv, port, dataDir, logLevel }
}
