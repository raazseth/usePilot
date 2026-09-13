import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { SkillDiscovery } from '../discovery/skill-discovery'
import { SkillResolver } from '../resolver/skill-resolver'
import { BUILTIN_SKILLS } from '../skills/builtin'
import { HOLDOUT_CORPUS, type HoldoutScenario } from './holdout-corpus'

describe('Blind Holdout Validation Test Suite (110 Unseen Scenarios)', () => {
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

  it('evaluates frozen skill discovery and resolver on completely unseen prompts', () => {
    let discoveryCorrect = 0
    let discoveryIncorrect = 0
    let falsePositives = 0
    let unsupportedCorrectlyRejected = 0
    let parametersCorrect = 0
    let parametersIncorrect = 0
    let clarificationsCorrect = 0
    let clarificationsIncorrect = 0
    let unsafeGuesses = 0

    const failures: Array<{
      scenarioId: string
      category: string
      prompt: string
      expectedSkill: string | null
      actualSkill: string | null
      reason: string
    }> = []

    for (const scenario of HOLDOUT_CORPUS) {
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
            reason: `DISCOVERY_FALSE_POSITIVE: Unsupported prompt matched "${actualSkillId}" with score ${topCandidate?.score}`,
          })
        }
        continue
      }

      // Check Discovery Accuracy
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
            ? 'DISCOVERY_NO_MATCH: No candidate met score threshold (score < 0.45)'
            : `DISCOVERY_WRONG_SKILL: Expected "${scenario.expectedSkillId}", got "${actualSkillId}" (score: ${topCandidate?.score})`,
        })
      }

      // Check Parameter Resolution & Clarification
      if (isExpectedMatch && actualSkillId) {
        const skill = registry.get(actualSkillId)!
        const resolution = resolver.resolve(skill, {}, {
          userPrompt: scenario.userPrompt,
          runtimeContext: scenario.context,
        })

        // Check required clarification
        if (scenario.expectMissingInputs) {
          const missingNames = resolution.missingInputs.map((m) => m.name)
          const allFound = scenario.expectMissingInputs.every((exp) => missingNames.includes(exp))
          if (!resolution.success && allFound) {
            clarificationsCorrect++
          } else {
            clarificationsIncorrect++
            // If the system guessed a value for a missing input without context, that is an unsafe guess!
            unsafeGuesses++
            failures.push({
              scenarioId: scenario.id,
              category: scenario.category,
              prompt: scenario.userPrompt,
              expectedSkill: scenario.expectedSkillId,
              actualSkill: actualSkillId,
              reason: `CLARIFICATION_FAILED: Expected missing [${scenario.expectMissingInputs.join(', ')}], got status "${resolution.status}" with missing [${missingNames.join(', ')}]`,
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
              reason: `PARAMETER_MISMATCH: Expected ${JSON.stringify(scenario.expectedInputs)}, got ${JSON.stringify(resolution.configuredInputs)}`,
            })
          }
        }
      }
    }

    const totalSupported = HOLDOUT_CORPUS.length - 25 // 85 supported
    const totalUnsupported = 25

    console.log('=================================================================')
    console.log('BLIND HOLDOUT METRICS ON UNSEEN PROMPTS')
    console.log('=================================================================')
    console.log(`Total Holdout Scenarios: ${HOLDOUT_CORPUS.length}`)
    console.log(`Discovery Accuracy: ${discoveryCorrect} / ${totalSupported} (${((discoveryCorrect / totalSupported) * 100).toFixed(1)}%)`)
    console.log(`False Positives: ${falsePositives} / ${totalUnsupported} (${((falsePositives / totalUnsupported) * 100).toFixed(1)}%)`)
    console.log(`Unsupported Correctly Rejected: ${unsupportedCorrectlyRejected} / ${totalUnsupported} (${((unsupportedCorrectlyRejected / totalUnsupported) * 100).toFixed(1)}%)`)
    console.log(`Parameters Correct: ${parametersCorrect} / ${parametersCorrect + parametersIncorrect} (${(((parametersCorrect) / (parametersCorrect + parametersIncorrect)) * 100).toFixed(1)}%)`)
    console.log(`Clarifications Correct: ${clarificationsCorrect} / ${clarificationsCorrect + clarificationsIncorrect} (${(((clarificationsCorrect) / (clarificationsCorrect + clarificationsIncorrect)) * 100).toFixed(1)}%)`)
    console.log(`Unsafe Guesses: ${unsafeGuesses}`)
    console.log(`Total Failures Recorded: ${failures.length}`)

    if (failures.length > 0) {
      console.log('Holdout Failures Detail:')
      for (const f of failures) {
        console.log(`- [${f.scenarioId}] [${f.category}] "${f.prompt}": ${f.reason}`)
      }
    }

    // Minimum quality gates defined by user:
    // Correct Skill > 90%
    expect(discoveryCorrect / totalSupported).toBeGreaterThanOrEqual(0.90)
    // False Positives < 5%
    expect(falsePositives / totalUnsupported).toBeLessThanOrEqual(0.05)
    // Correct Clarification > 90%
    expect(clarificationsCorrect / (clarificationsCorrect + clarificationsIncorrect)).toBeGreaterThanOrEqual(0.90)
    // Parameter Extraction > 90%
    expect(parametersCorrect / (parametersCorrect + parametersIncorrect)).toBeGreaterThanOrEqual(0.90)
    // Unsafe Guessing: EXACTLY 0
    expect(unsafeGuesses).toBe(0)
  })
})
