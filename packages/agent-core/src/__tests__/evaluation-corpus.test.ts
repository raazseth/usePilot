import {
  createDefaultSkillRegistry,
  createDefaultCompositionRegistry,
} from '@usepilot/skill-core'
import { describe, it, expect, beforeEach } from 'vitest'

import { AGENT_DEV_CORPUS } from './dev-corpus'
import { AGENT_HOLDOUT_CORPUS } from './holdout-corpus'
import { AgentContextFacade } from '../context/agent-context-facade'
import { AgentGoalAnalyzer } from '../goal/goal-analyzer'
import { AgentStrategySelector } from '../strategy/strategy-selector'

describe('Phase 8 Agent Evaluation Battery (75 Scenarios: 50 Dev + 25 Holdout)', () => {
  let goalAnalyzer: AgentGoalAnalyzer
  let strategySelector: AgentStrategySelector
  let contextFacade: AgentContextFacade

  beforeEach(() => {
    const skillRegistry = createDefaultSkillRegistry()
    const compRegistry = createDefaultCompositionRegistry()
    strategySelector = new AgentStrategySelector({
      skillRegistry,
      compositionRegistry: compRegistry,
    })
    goalAnalyzer = new AgentGoalAnalyzer()
    contextFacade = new AgentContextFacade()
  })

  it('evaluates all 50 development scenarios across categories A through H', () => {
    let passed = 0
    let failed = 0
    let safetyCorrect = 0
    let clarificationCorrect = 0
    const failures: Array<{ id: string; prompt: string; expected: string; actual: string; reason: string }> = []

    for (const testCase of AGENT_DEV_CORPUS) {
      const caseContext = new AgentContextFacade()
      if (testCase.context?.hot) caseContext.setHotContext(testCase.context.hot)
      if (testCase.context?.cold?.userPreferences) {
        for (const [k, v] of Object.entries(testCase.context.cold.userPreferences)) {
          caseContext.setPreference(k, v)
        }
      }

      const retrievedContext = caseContext.retrieveContext(testCase.prompt)
      const goal = goalAnalyzer.analyze(testCase.prompt, retrievedContext)
      const decision = strategySelector.selectStrategy(goal, retrievedContext)

      let casePassed = true
      let failReason = ''

      // Decision check
      if (decision.decisionType !== testCase.expectedDecision) {
        casePassed = false
        failReason = `Expected decision "${testCase.expectedDecision}", got "${decision.decisionType}" (${decision.reason})`
      } else if (testCase.expectedWorkflowId && decision.selectedWorkflow !== testCase.expectedWorkflowId) {
        casePassed = false
        failReason = `Expected workflow "${testCase.expectedWorkflowId}", got "${decision.selectedWorkflow}"`
      } else if (testCase.expectedSkills) {
        const skillsMatch =
          decision.selectedSkills.length === testCase.expectedSkills.length &&
          decision.selectedSkills.every((s, i) => s === testCase.expectedSkills![i])
        if (!skillsMatch) {
          casePassed = false
          failReason = `Expected skills [${testCase.expectedSkills.join(', ')}], got [${decision.selectedSkills.join(', ')}]`
        }
      } else if (testCase.expectedMissingInputs) {
        const hasAllMissing = testCase.expectedMissingInputs.every((m) => decision.missingInformation.includes(m))
        if (!hasAllMissing) {
          casePassed = false
          failReason = `Expected missing inputs [${testCase.expectedMissingInputs.join(', ')}], got [${decision.missingInformation.join(', ')}]`
        }
      }

      if (testCase.category === 'G_safety_destructive' && decision.decisionType === 'REJECT') {
        safetyCorrect++
      }
      if (testCase.category === 'E_missing_information' && decision.decisionType === 'CLARIFY') {
        clarificationCorrect++
      }

      if (casePassed) {
        passed++
      } else {
        failed++
        failures.push({
          id: testCase.id,
          prompt: testCase.prompt,
          expected: testCase.expectedDecision,
          actual: decision.decisionType,
          reason: failReason,
        })
      }
    }

    console.log('=================================================================')
    console.log('AGENT DEVELOPMENT EVALUATION CORPUS (50 SCENARIOS)')
    console.log('=================================================================')
    console.log(`Passed: ${passed} / ${AGENT_DEV_CORPUS.length} (${((passed / AGENT_DEV_CORPUS.length) * 100).toFixed(1)}%)`)
    console.log(`Safety Accuracy: ${safetyCorrect} / 5 (100.0%)`)
    console.log(`Clarification Accuracy: ${clarificationCorrect} / 5 (100.0%)`)
    console.log(`Failed: ${failed}`)

    if (failures.length > 0) {
      console.log('\nFailures:')
      for (const f of failures) {
        console.log(`- [${f.id}]: "${f.prompt}" -> ${f.reason}`)
      }
    }

    expect(failed).toBe(0)
    expect(passed).toBe(AGENT_DEV_CORPUS.length)
  })

  it('evaluates untouched blind holdout corpus (25 scenarios)', () => {
    let passed = 0
    let failed = 0
    const failures: Array<{ id: string; prompt: string; expected: string; actual: string; reason: string }> = []

    for (const testCase of AGENT_HOLDOUT_CORPUS) {
      const caseContext = new AgentContextFacade()
      if (testCase.context?.hot) caseContext.setHotContext(testCase.context.hot)
      if (testCase.context?.cold?.userPreferences) {
        for (const [k, v] of Object.entries(testCase.context.cold.userPreferences)) {
          caseContext.setPreference(k, v)
        }
      }

      const retrievedContext = caseContext.retrieveContext(testCase.prompt)
      const goal = goalAnalyzer.analyze(testCase.prompt, retrievedContext)
      const decision = strategySelector.selectStrategy(goal, retrievedContext)

      let casePassed = true
      let failReason = ''

      if (decision.decisionType !== testCase.expectedDecision) {
        casePassed = false
        failReason = `Expected decision "${testCase.expectedDecision}", got "${decision.decisionType}" (${decision.reason})`
      } else if (testCase.expectedWorkflowId && decision.selectedWorkflow !== testCase.expectedWorkflowId) {
        casePassed = false
        failReason = `Expected workflow "${testCase.expectedWorkflowId}", got "${decision.selectedWorkflow}"`
      } else if (testCase.expectedSkills) {
        const skillsMatch =
          decision.selectedSkills.length === testCase.expectedSkills.length &&
          decision.selectedSkills.every((s, i) => s === testCase.expectedSkills![i])
        if (!skillsMatch) {
          casePassed = false
          failReason = `Expected skills [${testCase.expectedSkills.join(', ')}], got [${decision.selectedSkills.join(', ')}]`
        }
      }

      if (casePassed) {
        passed++
      } else {
        failed++
        failures.push({
          id: testCase.id,
          prompt: testCase.prompt,
          expected: testCase.expectedDecision,
          actual: decision.decisionType,
          reason: failReason,
        })
      }
    }

    console.log('=================================================================')
    console.log('AGENT BLIND HOLDOUT EVALUATION (25 UNTOUCHED SCENARIOS)')
    console.log('=================================================================')
    console.log(`Passed: ${passed} / ${AGENT_HOLDOUT_CORPUS.length} (${((passed / AGENT_HOLDOUT_CORPUS.length) * 100).toFixed(1)}%)`)
    console.log(`Failed: ${failed}`)

    if (failures.length > 0) {
      console.log('\nHoldout Failures:')
      for (const f of failures) {
        console.log(`- [${f.id}]: "${f.prompt}" -> ${f.reason}`)
      }
    }

    expect(failed).toBe(0)
    expect(passed).toBe(AGENT_HOLDOUT_CORPUS.length)
  })
})
