// PolicyBasedCapabilityNegotiator — selects optimal adapter among candidates

import type {
  ICapabilityNegotiator,
  NegotiationContext,
  NegotiationResult,
  AdapterRegistration,
} from '@usepilot/execution-types'

export class PolicyBasedCapabilityNegotiator implements ICapabilityNegotiator {
  async negotiate(ctx: NegotiationContext): Promise<NegotiationResult> {
    const { candidates, platform } = ctx

    if (candidates.length === 0) {
      throw new Error(`No candidate adapters registered for capability "${ctx.task.requiredCapability}"`)
    }

    // Filter platform-compatible candidates
    const platformCompatible = candidates.filter(
      (c) => c.platformSupport.length === 0 || c.platformSupport.includes(platform)
    )

    if (platformCompatible.length === 0) {
      throw new Error(
        `No adapters compatible with platform "${platform}" for capability "${ctx.task.requiredCapability}"`
      )
    }

    // Probe availability
    const availableCandidates: AdapterRegistration[] = []
    for (const candidate of platformCompatible) {
      try {
        const instance = candidate.factory()
        const isAvail = await instance.isAvailable()
        if (isAvail) {
          availableCandidates.push(candidate)
        }
        await instance.dispose()
      } catch {
        // Probe failed, treat as unavailable
      }
    }

    // If none probed available, fall back to platform-compatible candidates
    const pool = availableCandidates.length > 0 ? availableCandidates : platformCompatible

    // Sort by priority descending
    pool.sort((a, b) => b.priority - a.priority)

    const selected = pool[0]!
    const fallbackCandidates = pool.slice(1)

    const rationale = availableCandidates.length > 0
      ? `Selected "${selected.name}" (priority ${selected.priority}) from ${availableCandidates.length} available candidate(s).`
      : `Selected "${selected.name}" (priority ${selected.priority}) as fallback; availability probes did not succeed.`

    return {
      selected,
      candidatesEvaluated: candidates.length,
      rationale,
      fallbackCandidates,
    }
  }
}
