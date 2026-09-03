import { ProviderRegistry } from '@usepilot/ai-providers'
import { ProviderRepository } from '@usepilot/database'
import type { AIProvider } from '@usepilot/ai-core'
import type { Logger } from '../../logger'
import type { EventBus } from '../../events/bus'

import type { DatabaseClient } from '@usepilot/database'

/**
 * Manages AI provider lifecycle.
 * Loads providers from DB, initializes the registry, and handles switching.
 */
export class ProviderManager {
  private readonly registry: ProviderRegistry
  private readonly providerRepo: ProviderRepository

  constructor(
    private readonly db: DatabaseClient,
    private readonly eventBus: EventBus,
    private readonly logger: Logger
  ) {
    this.registry = new ProviderRegistry()
    this.providerRepo = new ProviderRepository(this.db)
  }

  async initialize(): Promise<void> {
    const providers = await this.providerRepo.listEnabled()

    for (const p of providers) {
      this.registry.register({
        id: p.id,
        type: p.type,
        name: p.name,
        baseUrl: p.baseUrl,
      })

      if (p.isDefault) {
        this.registry.setActive(p.id)
      }

      this.logger.debug({ provider: p.name, type: p.type }, 'Provider registered')
    }

    const active = this.registry.getActive()
    if (active) {
      this.logger.info({ provider: active.name }, 'Active provider set')
    } else {
      this.logger.warn('No default provider configured')
    }
  }

  getActive(): AIProvider | null {
    return this.registry.getActive()
  }

  get(id: string): AIProvider | null {
    return this.registry.get(id)
  }

  async setActive(providerId: string): Promise<void> {
    this.registry.setActive(providerId)
    const provider = this.registry.getActive()!
    await this.eventBus.emit('provider.active.changed', {
      id: providerId,
      type: provider.type,
      name: provider.name,
    })
    this.logger.info({ provider: provider.name }, 'Active provider changed')
  }

  listAll() {
    return this.registry.listAll()
  }
}
