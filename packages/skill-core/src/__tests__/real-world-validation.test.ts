import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { SkillDiscovery } from '../discovery/skill-discovery'
import { SkillResolver } from '../resolver/skill-resolver'
import { BUILTIN_SKILLS } from '../skills/builtin'
import { VALIDATION_CORPUS, type ValidationScenario } from './validation-corpus'

describe('Real-World Skill Validation & Hardening Matrix (165 scenarios)', () => {
  let registry: SkillRegistry
  let discovery: SkillDiscovery
  let resolver: SkillResolver

  beforeEach(() => {
    registry = new SkillRegistry()
    for (const skill of BUILTIN_SKILLS) {
      registry.register(skill)
    }
    discovery = new SkillDiscovery(registry)
    resolver = new SkillResolver()
  })

  it('runs all 165 scenarios and calculates empirical accuracy', () => {
    let discoveryCorrect = 0
    let discoveryIncorrect = 0
    let falsePositives = 0
    let unsupportedCorrectlyRejected = 0
    let parametersCorrect = 0
    let parametersIncorrect = 0
    let clarificationsCorrect = 0
    let clarificationsIncorrect = 0

    const failures: Array<{
      scenarioId: string
      category: string
      prompt: string
      expectedSkill: string | null
      actualSkill: string | null
      reason: string
    }> = []

    for (const scenario of VALIDATION_CORPUS) {
      const candidates = discovery.discover({
        userPrompt: scenario.userPrompt,
      })
      const topCandidate = candidates.length > 0 ? candidates[0] : null
      const actualSkillId = topCandidate ? topCandidate.skillId : null

      // Check False Positives / Unsupported Requests
      if (scenario.expectedSkillId === null) {
        if (actualSkillId === null) {
          unsupportedCorrectlyRejected++
        } else {
          falsePositives++
          failures.push({
            scenarioId: scenario.id,
            category: scenario.category,
            prompt: scenario.userPrompt,
            expectedSkill: null,
            actualSkill: actualSkillId,
            reason: `DISCOVERY_FALSE_POSITIVE: Unsupported request matched "${actualSkillId}" with score ${topCandidate?.score} (reasons: ${topCandidate?.reasons.join(' | ')})`,
          })
        }
        continue
      }

      // Check Discovery
      const isExpectedMatch =
        actualSkillId === scenario.expectedSkillId ||
        (scenario.expectedSkillId !== null && registry.get(scenario.expectedSkillId)?.id === actualSkillId)

      if (isExpectedMatch) {
        discoveryCorrect++
      } else {
        discoveryIncorrect++
        failures.push({
          scenarioId: scenario.id,
          category: scenario.category,
          prompt: scenario.userPrompt,
          expectedSkill: scenario.expectedSkillId,
          actualSkill: actualSkillId,
          reason: actualSkillId === null
            ? `DISCOVERY_NO_MATCH: No candidate found (score < 0.45)`
            : `DISCOVERY_WRONG_SKILL: Expected "${scenario.expectedSkillId}", got "${actualSkillId}" (score: ${topCandidate?.score}) (reasons: ${topCandidate?.reasons.join(' | ')})`,
        })
      }

      // Check Parameter Resolution if expected inputs or missing inputs specified
      if (isExpectedMatch && actualSkillId) {
        const skill = registry.get(actualSkillId)!
        const resolution = resolver.resolve(skill, {}, {
          userPrompt: scenario.userPrompt,
          runtimeContext: scenario.context,
        })

        // Check missing input clarification
        if (scenario.expectMissingInputs) {
          const missingNames = resolution.missingInputs.map((m) => m.name)
          const allFound = scenario.expectMissingInputs.every((exp) => missingNames.includes(exp))
          if (!resolution.success && allFound) {
            clarificationsCorrect++
          } else {
            clarificationsIncorrect++
            failures.push({
              scenarioId: scenario.id,
              category: scenario.category,
              prompt: scenario.userPrompt,
              expectedSkill: scenario.expectedSkillId,
              actualSkill: actualSkillId,
              reason: `CLARIFICATION_MISSED: Expected missing [${scenario.expectMissingInputs.join(', ')}], got [${missingNames.join(', ')}]`,
            })
          }
        }

        // Check expected inputs
        if (scenario.expectedInputs) {
          let matches = true
          for (const [k, v] of Object.entries(scenario.expectedInputs)) {
            if (resolution.configuredInputs[k] !== v) {
              matches = false
              break
            }
          }
          if (matches) {
            parametersCorrect++
          } else {
            parametersIncorrect++
            failures.push({
              scenarioId: scenario.id,
              category: scenario.category,
              prompt: scenario.userPrompt,
              expectedSkill: scenario.expectedSkillId,
              actualSkill: actualSkillId,
              reason: `PARAMETER_MISSED: Expected inputs ${JSON.stringify(scenario.expectedInputs)}, got ${JSON.stringify(resolution.configuredInputs)}`,
            })
          }
        }
      }
    }

    console.log('--- BASELINE VALIDATION METRICS ---')
    console.log(`Total Scenarios: ${VALIDATION_CORPUS.length}`)
    console.log(`Discovery Correct: ${discoveryCorrect}`)
    console.log(`Discovery Incorrect: ${discoveryIncorrect}`)
    console.log(`False Positives: ${falsePositives}`)
    console.log(`Unsupported Correctly Rejected: ${unsupportedCorrectlyRejected}`)
    console.log(`Parameters Correct: ${parametersCorrect}`)
    console.log(`Parameters Incorrect: ${parametersIncorrect}`)
    console.log(`Clarifications Correct: ${clarificationsCorrect}`)
    console.log(`Clarifications Incorrect: ${clarificationsIncorrect}`)
    console.log(`Total Failures Recorded: ${failures.length}`)

    // Print first 20 failure samples for diagnosis
    console.log('Sample Failures (first 25):')
    for (const f of failures.slice(0, 25)) {
      console.log(`[${f.scenarioId}] [${f.category}] "${f.prompt}" -> ${f.reason}`)
    }

    expect(failures).toEqual([])
    expect(discoveryCorrect).toBe(130)
    expect(falsePositives).toBe(0)
    expect(unsupportedCorrectlyRejected).toBe(35)
    expect(parametersCorrect).toBeGreaterThanOrEqual(45)
    expect(clarificationsCorrect).toBeGreaterThanOrEqual(10)
  })
})
