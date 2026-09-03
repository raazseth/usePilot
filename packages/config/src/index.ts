// Centralized configuration — single source of truth for all config
// Every config value in the application flows through here.

export { environmentConfig, EnvironmentSchema } from './environment'
export { appConfig, AppConfigSchema } from './app'
export { databaseConfig, DatabaseConfigSchema } from './database'
export { providerDefaults, ProviderDefaultsSchema } from './providers'
export { defaultFeatureFlags, FeatureFlagsSchema, type FeatureFlags } from './features'

// Re-export zod for schema composition in other packages
export { z } from 'zod'
