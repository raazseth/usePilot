import type { TaskCapability } from '@usepilot/planner-types'
import type { SkillCandidate, SkillDiscoveryQuery, SkillMatchConfidence } from '@usepilot/skill-types'
import type { SkillRegistry } from '../registry/skill-registry'
import {
  tokenizeNormalized,
  extractPromptSignals,
  normalizeToken,
  STOPWORDS,
} from './nlp-matcher'

function computeSignificantTokenOverlap(promptTokens: string[], targetTokens: string[]): { ratio: number; matchCount: number } {
  const promptSignificant = new Set(promptTokens.filter((t) => !STOPWORDS.has(t)))
  const targetSignificant = targetTokens.filter((t) => !STOPWORDS.has(t))
  if (targetSignificant.length === 0 || promptSignificant.size === 0) {
    return { ratio: 0, matchCount: 0 }
  }
  let matchCount = 0
  for (const t of targetSignificant) {
    if (promptSignificant.has(t)) matchCount++
  }
  return {
    ratio: matchCount / targetSignificant.length,
    matchCount,
  }
}

export interface SkillDiscoveryOptions {
  capabilityProvider?: ((capability: TaskCapability) => boolean) | undefined
}

/**
 * SkillDiscovery — Deterministic, Domain-Discriminated & Semantic Matching for Skills.
 *
 * Sits between User Intent and Skill Selection.
 * Provides:
 * - Deterministic lemmatization and token overlap
 * - Core intent discriminator enforcement (e.g. duplicate vs find, rename vs organize)
 * - Domain discrimination (web vs filesystem vs cross-runtime)
 * - Calibrated confidence states (clear, ambiguous, insufficient_context, unsupported)
 * - Rejection of out-of-domain / unsupported requests without guessing
 */
export class SkillDiscovery {
  constructor(
    private readonly registry: SkillRegistry,
    private readonly options?: SkillDiscoveryOptions
  ) {}

  /**
   * Discover candidate Skills that satisfy a user prompt or goal.
   */
  discover(query: SkillDiscoveryQuery): SkillCandidate[] {
    const rawPrompt = query.userPrompt ?? query.text ?? ''
    if (!rawPrompt.trim()) return []

    const promptLower = rawPrompt.toLowerCase().trim()
    const signals = extractPromptSignals(rawPrompt)
    const promptTokens = signals.normalizedTokens
    const { category, intent, platform = 'windows' } = query
    const availableCapabilities = query.availableCapabilities ?? []

    const skills = this.registry.list(category)
    const rawCandidates: Array<{
      candidate: SkillCandidate
      rawScore: number
    }> = []

    for (const skill of skills) {
      const reasons: string[] = []
      const matchedExamples: string[] = []
      let score = 0
      const skillId = skill.id

      // 1. Example phrase & normalized token match
      for (const example of skill.metadata.examples) {
        const exampleLower = example.toLowerCase().trim()
        if (promptLower.includes(exampleLower) || exampleLower.includes(promptLower)) {
          score = Math.max(score, 0.95)
          matchedExamples.push(example)
          reasons.push(`Matched example phrase: "${example}"`)
        } else {
          const exampleTokens = tokenizeNormalized(example)
          const { ratio, matchCount } = computeSignificantTokenOverlap(promptTokens, exampleTokens)
          if (ratio >= 0.6 && matchCount >= 2) {
            const exampleScore = 0.65 + ratio * 0.3
            if (exampleScore > score) {
              score = exampleScore
              matchedExamples.push(example)
              reasons.push(`High token overlap (${Math.round(ratio * 100)}%) with example: "${example}"`)
            }
          }
        }
      }

      // 2. Name match (exact substantive concept coverage)
      const nameTokens = tokenizeNormalized(skill.name)
      const { ratio: nameRatio, matchCount: nameMatchCount } = computeSignificantTokenOverlap(promptTokens, nameTokens)
      if (promptLower.includes(skill.name.toLowerCase())) {
        score = Math.max(score, 0.9)
        reasons.push(`Prompt explicitly names skill "${skill.name}"`)
      } else if (nameRatio === 1.0 && nameMatchCount >= 2) {
        // Complete coverage of all substantive words in skill name (e.g. "Download the documents" -> download, document)
        score = Math.max(score, 0.9)
        reasons.push(`Prompt matches all substantive concepts in skill name "${skill.name}"`)
      } else if (nameRatio >= 0.5 && nameMatchCount >= 2) {
        score = Math.max(score, 0.55 + nameRatio * 0.3)
        reasons.push(`Partial match on skill name "${skill.name}"`)
      } else if (nameRatio >= 0.5 && nameMatchCount === 1) {
        const matchingWord = nameTokens.find((t) => promptTokens.includes(t))
        if (matchingWord && !['website', 'file', 'files', 'folder', 'download', 'downloads'].includes(matchingWord)) {
          score = Math.max(score, 0.45)
          reasons.push(`Action keyword match on skill name "${skill.name}"`)
        }
      }

      // 3. Tag matches (exact token membership)
      let tagMatches = 0
      for (const tag of skill.metadata.tags) {
        const normTag = normalizeToken(tag)
        if (promptTokens.includes(normTag)) {
          tagMatches++
        }
      }
      if (tagMatches > 0) {
        const tagBoost = Math.min(tagMatches * 0.08, 0.24)
        score = Math.max(score, score + tagBoost)
        reasons.push(`Matched ${tagMatches} tag keywords`)
      }

      // 4. Description token overlap
      const descTokens = tokenizeNormalized(skill.description)
      const { ratio: descOverlap } = computeSignificantTokenOverlap(promptTokens, descTokens)
      if (descOverlap >= 0.3) {
        score = Math.max(score, score + descOverlap * 0.15)
        reasons.push(`Description relevance match (${Math.round(descOverlap * 100)}%)`)
      }

      // 5. Specialized Intent Disambiguation & Core Discriminators

      // A. Duplicate Intent
      if (skillId === 'duplicate-file-detection' || skillId === 'duplicate-detection') {
        if (signals.hasDuplicateSignal) {
          score += 0.55
          reasons.push('Specialized duplicate detection intent detected')
        } else {
          // If no duplicate signal in prompt, heavily suppress duplicate-detection
          score = Math.min(score, 0.25)
        }
      } else if (skillId === 'find-files' && signals.hasDuplicateSignal) {
        score -= 0.65
        reasons.push('Duplicate intent takes precedence over generic file finding')
      }

      // B. Rename Intent
      if (skillId === 'bulk-rename-files' || skillId === 'bulk-rename') {
        if (signals.hasRenameSignal) {
          score += 0.65
          reasons.push('Bulk rename intent detected')
        } else {
          score = Math.min(score, 0.25)
        }
      } else if (signals.hasRenameSignal) {
        score -= 0.65
        reasons.push('Rename intent demotes non-rename skills')
      }

      // C. Form Fill Intent
      if (skillId === 'fill-web-form') {
        if (signals.hasFormSignal) {
          score += 0.55
          reasons.push('Web form interaction intent detected')
        } else {
          score = Math.min(score, 0.25)
        }
      }

      // D. Find Files Intent
      if (skillId === 'find-files') {
        if (signals.hasFindSignal && !signals.hasDuplicateSignal && !signals.hasWebDocumentSignal && !signals.hasUrl) {
          score += 0.55
          reasons.push('Local filesystem file search intent detected')
        }
      }

      // E. Organize Intent
      if (signals.hasOrganizeSignal && !signals.hasRenameSignal) {
        if (skillId === 'organize-downloads') {
          score += 0.45
          reasons.push('Organize / cleanup intent detected')
        }
      }

      // F. Cross-Runtime Intent
      if (signals.hasCrossDownloadAndOrganize) {
        if (skillId === 'download-and-organize') {
          score += 0.85
          reasons.push('Cross-runtime download and organize intent detected')
        } else if (skillId === 'download-documents') {
          score -= 0.55
          reasons.push('Composite download-and-organize preferred over pure download')
        } else if (skillId === 'organize-downloads') {
          score = Math.min(score, 0.25)
          reasons.push('Compound download-and-organize request cannot be fulfilled by local-only organize-downloads')
        }
      } else if (signals.hasCrossResearchAndSave) {
        if (skillId === 'research-and-save-report') {
          score += 0.85
          reasons.push('Cross-runtime research and save report intent detected')
        } else if (skillId === 'research-website') {
          score -= 0.55
          reasons.push('Composite research-and-save-report preferred over pure research')
        }
      } else {
        // If neither cross-runtime applies, suppress accidental matching of composite skills
        if (skillId === 'download-and-organize' && !signals.hasUrl && !signals.hasWebKeyword) {
          score = Math.min(score, 0.25)
        }
        if (skillId === 'research-and-save-report' && !signals.hasResearchSignal) {
          score = Math.min(score, 0.25)
        }
      }

      // G. Web Documents Seeking Intent
      if (skillId === 'download-documents') {
        if (signals.hasWebDocumentSignal && !signals.hasCrossDownloadAndOrganize) {
          score += 0.75
          reasons.push('Web document download intent detected')
        }
      }

      // H. Research Website Intent
      if (skillId === 'research-website') {
        if (signals.hasResearchSignal && !signals.hasCrossResearchAndSave) {
          score += 0.65
          reasons.push('Web research and content analysis intent detected')
        } else if (!signals.hasResearchSignal && !signals.hasUrl) {
          score = Math.min(score, 0.25)
        }
      }

      // H. Data Extraction Intent
      if (skillId === 'extract-website-data') {
        if (signals.hasExtractSignal && !signals.hasWebDocumentSignal) {
          score += 0.55
          reasons.push('Data extraction / scraping intent detected')
        }
      }

      // I. Web vs Local Filesystem Domain Discrimination
      const isLocalOnly = ['find-files', 'organize-downloads', 'bulk-rename-files', 'duplicate-file-detection'].includes(skillId)
      const isBrowserOnly = ['research-website', 'extract-website-data', 'download-documents', 'fill-web-form'].includes(skillId)

      if (signals.hasUrl || (signals.hasWebKeyword && !signals.hasFilesystemKeyword)) {
        if (isLocalOnly) {
          score -= 0.55
          reasons.push('Web domain intent detected; local filesystem skill demoted')
        }
      } else if (signals.hasFilesystemKeyword && !signals.hasWebKeyword && !signals.hasUrl && !signals.hasFormSignal && !signals.hasWebDocumentSignal) {
        if (isBrowserOnly) {
          score -= 0.55
          reasons.push('Local filesystem intent detected without URL; browser skill demoted')
        }
      }

      // SQL / Database queries must never match browser web data extraction
      if (signals.isDatabaseQuery && isBrowserOnly) {
        score = Math.min(score, 0.25)
        reasons.push('Database query detected without web URL; browser skill suppressed')
      }

      // 6. Intent Category Boost / Penalty from Planner Intent
      if (intent) {
        const categoryMatches =
          (intent.type === 'filesystem' && skill.category === 'filesystem') ||
          (intent.type === 'browser' && skill.category === 'browser') ||
          (intent.type === 'desktop' && skill.category === 'desktop') ||
          (intent.type === 'mixed' && skill.category === 'cross_runtime') ||
          (intent.type === 'research' && (skill.category === 'browser' || skill.category === 'cross_runtime'))

        if (categoryMatches) {
          score = Math.min(1.0, score + 0.1)
          reasons.push(`Category "${skill.category}" matches planner intent "${intent.type}"`)
        }
      }

      // 7. Capability Verification
      let unavailableCapabilities: TaskCapability[] = []
      if (this.options?.capabilityProvider) {
        unavailableCapabilities = skill.requiredCapabilities.filter((c) => !this.options!.capabilityProvider!(c))
      } else if (availableCapabilities.length > 0) {
        const availability = this.registry.checkAvailability(
          skill.id,
          availableCapabilities,
          undefined,
          platform
        )
        unavailableCapabilities = availability.missingCapabilities
      }

      if (unavailableCapabilities.length > 0) {
        score = Math.max(0, score - 0.25)
        reasons.push(`Host missing ${unavailableCapabilities.length} required capability(ies)`)
      }

      // Cutoff threshold: score >= 0.45 to be a meaningful candidate
      if (score >= 0.45) {
        const missingInputs: string[] = []
        for (const [key, inputDef] of Object.entries(skill.inputs)) {
          if (inputDef.required) {
            if (inputDef.type === 'url' && !/https?:\/\/[^\s]+/.test(rawPrompt)) {
              missingInputs.push(key)
            } else if (
              inputDef.type === 'path' &&
              !/(?:[a-zA-Z]:\\|\/|~\/|\.\/)/.test(rawPrompt) &&
              !promptLower.includes('download') &&
              !promptLower.includes('document') &&
              !promptLower.includes('desktop') &&
              !promptLower.includes('photos') &&
              !promptLower.includes('pictures')
            ) {
              missingInputs.push(key)
            }
          }
        }

        const candidate: SkillCandidate = {
          skillId: skill.id,
          skillVersion: skill.version,
          name: skill.name,
          description: skill.description,
          score: Math.round(score * 100) / 100,
          reasons,
          matchedExamples,
          missingInputs,
          unavailableCapabilities,
          isResolvable: unavailableCapabilities.length === 0,
          skill,
        }

        rawCandidates.push({ candidate, rawScore: score })
      }
    }

    // Sort descending by score
    rawCandidates.sort((a, b) => b.rawScore - a.rawScore)

    // Assign calibrated confidence levels
    const results: SkillCandidate[] = rawCandidates.map((item, idx) => {
      const c = item.candidate
      let confidence: SkillMatchConfidence = 'clear'

      if (rawCandidates.length > 1 && idx === 0) {
        const margin = item.rawScore - rawCandidates[1]!.rawScore
        if (margin < 0.15 && rawCandidates[1]!.rawScore >= 0.50) {
          confidence = 'ambiguous'
        }
      }

      if (c.missingInputs.length > 0) {
        confidence = confidence === 'ambiguous' ? 'ambiguous' : 'insufficient_context'
      }

      return {
        ...c,
        confidence,
      }
    })

    return results
  }
}
