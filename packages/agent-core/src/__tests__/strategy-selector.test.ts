import {
  createDefaultSkillRegistry,
  createDefaultCompositionRegistry,
} from '@usepilot/skill-core'
import { describe, it, expect, beforeEach } from 'vitest'

import { AgentGoalAnalyzer } from '../goal/goal-analyzer'
import { AgentStrategySelector } from '../strategy/strategy-selector'

describe('AgentStrategySelector', () => {
  let strategySelector: AgentStrategySelector
  let goalAnalyzer: AgentGoalAnalyzer

  beforeEach(() => {
    const skillRegistry = createDefaultSkillRegistry()
    const compRegistry = createDefaultCompositionRegistry()
    strategySelector = new AgentStrategySelector({
      skillRegistry,
      compositionRegistry: compRegistry,
    })
    goalAnalyzer = new AgentGoalAnalyzer()
  })

  it('prefers reusing existing workflow over dynamic composition when exact match exists', () => {
    const goal = goalAnalyzer.analyze(
      'Audit my Downloads folder for duplicates and organize what is left by file type'
    )
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('REUSE_WORKFLOW')
    expect(decision.selectedWorkflow).toBe('audit-and-clean-downloads')
    expect(decision.selectedSkills).toEqual(['duplicate-file-detection', 'organize-downloads'])
    expect(decision.confidence).toBe('HIGH')
  })

  it('dynamically composes a valid DAG for novel skill sequences', () => {
    const goal = goalAnalyzer.analyze(
      'Download all PDFs from https://acme.org/specs to C:/Downloads, and then check for duplicate files in C:/Downloads'
    )
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('COMPOSE')
    expect(decision.selectedSkills).toEqual(['download-documents', 'duplicate-file-detection'])
    expect(decision.workflowDefinition).toBeDefined()
    expect(decision.workflowDefinition?.steps.length).toBe(2)
  })

  it('routes to single skill execution when goal is covered by one skill', () => {
    const goal = goalAnalyzer.analyze('Extract the pricing table from https://example.com/pricing')
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('EXECUTE')
    expect(decision.selectedSkills).toEqual(['extract-website-data'])
  })

  it('halts with CLARIFY when required information is missing', () => {
    const goal = goalAnalyzer.analyze(
      'Go to this website, download the latest PDF and put it in my Documents folder'
    )
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('CLARIFY')
    expect(decision.missingInformation).toContain('url')
  })

  it('rejects destructive operations targeting system directories', () => {
    const goal = goalAnalyzer.analyze(
      'Find all system files in C:/Windows/System32 and delete them all permanently'
    )
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('REJECT')
    expect(decision.riskLevel).toBe('critical')
  })

  it('rejects out-of-domain unsupported requests', () => {
    const goal = goalAnalyzer.analyze('Order a large pepperoni pizza on DoorDash')
    const decision = strategySelector.selectStrategy(goal)

    expect(decision.decisionType).toBe('REJECT')
  })
})
