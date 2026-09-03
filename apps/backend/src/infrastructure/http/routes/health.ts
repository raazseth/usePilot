import type { RouteHandler } from '../router'
import type { ProviderManager } from '../../ai/provider-manager'
import { json } from '../router'

export function healthRouter(providerManager: ProviderManager): RouteHandler {
  return async (req, url) => {
    if (req.method !== 'GET' || url.pathname !== '/health') return null

    const active = providerManager.getActive()
    let providerHealth = null

    if (active) {
      providerHealth = await active.healthCheck()
    }

    return json({
      status: 'ok',
      version: '0.1.0',
      uptime: process.uptime(),
      provider: active
        ? { name: active.name, type: active.type, health: providerHealth }
        : null,
    })
  }
}
