// CapabilityRegistry — dynamic adapter registry, no hardcoded mappings

import type { ICapabilityAdapter, AdapterFactory, AdapterRegistration } from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'

export class CapabilityRegistry {
  private readonly registrations = new Map<TaskCapability, AdapterRegistration[]>()

  register(registration: AdapterRegistration): void {
    const existing = this.registrations.get(registration.capability) ?? []
    existing.push(registration)
    existing.sort((a, b) => b.priority - a.priority)
    this.registrations.set(registration.capability, existing)
  }

  resolve(
    capability: TaskCapability,
    platform: 'windows' | 'macos' | 'linux' = 'windows',
    config?: Record<string, unknown>
  ): ICapabilityAdapter {
    const candidates = this.registrations.get(capability) ?? []

    const compatible = candidates.filter(
      (r) => r.platformSupport.length === 0 || r.platformSupport.includes(platform)
    )

    if (compatible.length === 0) {
      throw new Error(
        `No adapter registered for capability "${capability}" on platform "${platform}"`
      )
    }

    return compatible[0]!.factory(config)
  }

  hasAdapter(capability: TaskCapability, platform?: 'windows' | 'macos' | 'linux'): boolean {
    const candidates = this.registrations.get(capability) ?? []
    if (!platform) return candidates.length > 0
    return candidates.some(
      (r) => r.platformSupport.length === 0 || r.platformSupport.includes(platform)
    )
  }

  listRegistered(): AdapterRegistration[] {
    const all: AdapterRegistration[] = []
    for (const regs of this.registrations.values()) {
      all.push(...regs)
    }
    return all
  }

  getCandidates(capability: TaskCapability): AdapterRegistration[] {
    return [...(this.registrations.get(capability) ?? [])]
  }

  async negotiate(
    task: import('@usepilot/planner-types').Task,
    blueprint: import('@usepilot/planner-types').ExecutionBlueprint,
    platform: 'windows' | 'macos' | 'linux' = 'windows',
    negotiator?: import('@usepilot/execution-types').ICapabilityNegotiator
  ): Promise<{ adapter: ICapabilityAdapter; decision: import('@usepilot/execution-types').NegotiationResult }> {
    const candidates = this.getCandidates(task.requiredCapability)
    const activeNegotiator = negotiator ?? new (await import('./negotiator')).PolicyBasedCapabilityNegotiator()

    const decision = await activeNegotiator.negotiate({
      task,
      blueprint,
      platform,
      candidates,
    })

    const adapter = decision.selected.factory()
    return { adapter, decision }
  }

  registeredCapabilities(): TaskCapability[] {
    return Array.from(this.registrations.keys())
  }
}
