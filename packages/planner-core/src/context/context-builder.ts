// PlannerContextBuilder

import type { PlannerContext, PlannerSettingsContext, TaskTool, BlueprintSummary } from '@usepilot/planner-types'

export interface ContextBuilderInput {
  conversationId: string
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string; timestamp: number }>
  settings: {
    activeProviderType?: string | undefined
    defaultModel?: string | undefined
    temperature?: number | string | undefined
    featureFlags?: Record<string, unknown> | undefined
  }
  previousBlueprints?: BlueprintSummary[] | undefined
  userPreferences?: Record<string, unknown> | undefined
}

function detectPlatform(): 'windows' | 'macos' | 'linux' {
  // Bun/Node environment
  if (typeof process !== 'undefined') {
    const p = process.platform
    if (p === 'win32') return 'windows'
    if (p === 'darwin') return 'macos'
    return 'linux'
  }
  return 'linux'
}

function detectAvailableTools(): TaskTool[] {
  // In Phase 2, tools are declared statically.
  // Phase 3 will probe actual tool availability (playwright, etc.)
  const tools: TaskTool[] = ['api', 'clipboard', 'none']
  if (detectPlatform() !== 'linux') {
    // Non-linux platforms generally support all tools
    tools.push('browser', 'filesystem', 'email', 'terminal')
  } else {
    tools.push('browser', 'filesystem', 'terminal')
  }
  return tools
}

export class PlannerContextBuilder {
  build(input: ContextBuilderInput): PlannerContext {
    const settings: PlannerSettingsContext = {
      activeProviderType: input.settings.activeProviderType,
      defaultModel: input.settings.defaultModel,
      temperature: Number(input.settings.temperature ?? 0.7),
      featureFlags: input.settings.featureFlags ?? {},
    }

    return {
      conversationId: input.conversationId,
      conversationHistory: input.conversationHistory,
      settings,
      availableTools: detectAvailableTools(),
      platform: detectPlatform(),
      previousBlueprints: input.previousBlueprints ?? [],
      userPreferences: input.userPreferences,
    }
  }
}
