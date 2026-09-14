import type { AgentManifest } from '@usepilot/agent-types'
import { AgentManifestSchema } from '@usepilot/agent-types'

export const DEFAULT_COMPUTER_AGENT_MANIFEST: AgentManifest = {
  id: 'usepilot-computer-agent',
  name: 'usePilot Computer Operator',
  description: 'Primary desktop and browser autonomous workflow execution agent.',
  version: '1.0.0',
  supportedDomains: ['browser', 'filesystem', 'desktop', 'cross-runtime'],
  requiredCapabilities: [
    'read_file',
    'write_file',
    'move_file',
    'navigate_website',
    'download_file',
  ],
  riskPolicy: {
    autoApproveLowRisk: true,
    requireApprovalForMediumRisk: false,
    requireApprovalForHighRisk: true,
    blockCriticalRisk: true,
  },
  approvalPolicy: {
    mode: 'on_risk_threshold',
    riskThreshold: 'high',
  },
  maxReplans: 2,
  maxSteps: 10,
  maxIterations: 5,
}

/**
 * AgentRegistry — Stores, validates, and manages immutable AgentManifest definitions.
 */
export class AgentRegistry {
  private readonly agents = new Map<string, AgentManifest>()

  constructor() {
    this.register(DEFAULT_COMPUTER_AGENT_MANIFEST)
  }

  register(manifest: AgentManifest): void {
    // Validate schema
    const parsed = AgentManifestSchema.parse(manifest)

    const existing = this.agents.get(parsed.id)
    if (existing) {
      if (JSON.stringify(existing) !== JSON.stringify(parsed)) {
        throw new Error(`Agent "${parsed.id}" is already registered. Manifests are immutable.`)
      }
      return
    }

    // Freeze to enforce immutability
    this.agents.set(parsed.id, Object.freeze({ ...parsed }))
  }

  get(id: string): AgentManifest | undefined {
    return this.agents.get(id)
  }

  has(id: string): boolean {
    return this.agents.has(id)
  }

  list(): readonly AgentManifest[] {
    return Array.from(this.agents.values())
  }

  size(): number {
    return this.agents.size
  }
}

export function createDefaultAgentRegistry(): AgentRegistry {
  return new AgentRegistry()
}
