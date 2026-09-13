import type {
  SkillComposition,
  WorkflowRouteRequest,
  WorkflowRouteResult,
} from '@usepilot/skill-types'

import { CompositionValidator } from './composition-validator'
import { tokenizeNormalized, extractPromptSignals, STOPWORDS } from '../discovery/nlp-matcher'
import { SkillDiscovery } from '../discovery/skill-discovery'
import type { SkillCompositionRegistry } from '../registry/composition-registry'
import type { SkillRegistry } from '../registry/skill-registry'

function computeTokenOverlap(promptTokens: string[], targetTokens: string[]): number {
  const promptSignificant = new Set(promptTokens.filter((t) => !STOPWORDS.has(t)))
  const targetSignificant = targetTokens.filter((t) => !STOPWORDS.has(t))
  if (targetSignificant.length === 0 || promptSignificant.size === 0) return 0
  let matches = 0
  for (const t of targetSignificant) {
    if (promptSignificant.has(t)) matches++
  }
  return matches / targetSignificant.length
}

/**
 * GoalWorkflowRouter — Goal-to-Workflow Analysis and Routing Engine for Phase 7.
 *
 * Takes an arbitrary user goal and determines:
 * 1. Destructive safety violations (e.g. system directory deletion, formatting drives)
 * 2. Conflicting/contradictory requirements (e.g. delete vs don't delete)
 * 3. Unsupported out-of-domain requests (e.g. pizza ordering, email, databases)
 * 4. Missing critical parameters requiring user clarification
 * 5. Predefined workflow composition match (e.g. research-download-and-organize)
 * 6. Dynamic multi-skill composition (composing novel skill sequences on the fly)
 * 7. Single skill execution fallback
 */
export class GoalWorkflowRouter {
  private readonly discovery: SkillDiscovery
  private readonly validator: CompositionValidator

  constructor(
    private readonly skillRegistry: SkillRegistry,
    private readonly compositionRegistry: SkillCompositionRegistry
  ) {
    this.discovery = new SkillDiscovery(skillRegistry)
    this.validator = new CompositionValidator(skillRegistry)
  }

  route(request: WorkflowRouteRequest | string): WorkflowRouteResult {
    const rawGoal = typeof request === 'string' ? request : request.goal
    const trimmedGoal = rawGoal.trim()
    if (!trimmedGoal) {
      return {
        status: 'unsupported',
        confidence: 0,
        reason: 'Empty goal provided.',
      }
    }

    const lower = trimmedGoal.toLowerCase()
    const signals = extractPromptSignals(trimmedGoal)

    // 1. Destructive safety check
    const destructiveResult = this.checkDestructiveGuard(trimmedGoal, lower)
    if (destructiveResult) return destructiveResult

    // 2. Conflicting requirements check
    const conflictResult = this.checkConflictingRequirements(trimmedGoal, lower)
    if (conflictResult) return conflictResult

    // 3. Unsupported out-of-domain check
    const unsupportedResult = this.checkUnsupportedDomain(trimmedGoal, lower)
    if (unsupportedResult) return unsupportedResult

    // 4. Missing vital parameters / clarification check for multi-step intents
    const clarificationResult = this.checkClarificationNeeded(trimmedGoal, lower, signals)
    if (clarificationResult) return clarificationResult

    // 5. Predefined composition matching
    const matchedComposition = this.matchPredefinedComposition(trimmedGoal, signals)
    if (matchedComposition) {
      return {
        status: 'matched_composition',
        composition: matchedComposition.composition,
        confidence: matchedComposition.confidence,
        reason: `Matched predefined composition "${matchedComposition.composition.name}" (${matchedComposition.composition.id}).`,
      }
    }

    // 6. Dynamic multi-skill composition check (splitting on connectors)
    const dynamicResult = this.attemptDynamicComposition(trimmedGoal, signals)
    if (dynamicResult) return dynamicResult

    // 7. Single skill discovery fallback
    const singleCandidates = this.discovery.discover({ userPrompt: trimmedGoal })
    if (singleCandidates.length > 0 && singleCandidates[0]!.score >= 0.45) {
      const top = singleCandidates[0]!
      return {
        status: 'single_skill',
        singleSkillId: top.skillId,
        confidence: top.score,
        reason: `Matched single skill "${top.name}" (${top.skillId}) with confidence ${top.confidence}.`,
      }
    }

    return {
      status: 'unsupported',
      confidence: 0,
      reason: 'No registered skill or workflow composition can satisfy this goal.',
    }
  }

  private checkDestructiveGuard(raw: string, lower: string): WorkflowRouteResult | null {
    const isDestructiveTarget =
      /c:[/\\]windows/i.test(raw) ||
      /system32/i.test(raw) ||
      /c:[/\\]program files/i.test(raw) ||
      /\bformat\s+(?:drive\s+)?[a-z]:/i.test(lower) ||
      /\bwipe\s+(?:my\s+)?(?:entire\s+)?(?:hard\s+drive|drive\s+c|system)/i.test(lower) ||
      /\bdelete\s+(?:all\s+)?system\s+files/i.test(lower)

    if (isDestructiveTarget) {
      return {
        status: 'destructive_rejected',
        confidence: 1.0,
        reason: 'Goal requests destructive modifications to system locations or disk formats, which is prohibited by safety policy.',
      }
    }
    return null
  }

  private checkConflictingRequirements(raw: string, lower: string): WorkflowRouteResult | null {
    const conflicts: string[] = []

    if (
      (/\b(?:clean up|delete|remove)\b/i.test(lower) && /\bdon'?t\s+delete\s+(?:any\s+)?(?:files|thing)\b/i.test(lower)) ||
      (/\bdelete\s+everything\b/i.test(lower) && /\bkeep\s+all\b/i.test(lower))
    ) {
      conflicts.push('Request asks to clean up/delete while explicitly forbidding deleting any files.')
    }

    if (
      /\bwithout\s+(?:using\s+)?(?:an?\s+)?(?:internet|browser|web|network)\b/i.test(lower) &&
      (/(?:https?:\/\/|website|online|download\s+the\s+quarterly)/i.test(lower))
    ) {
      conflicts.push('Request requires fetching remote web content without using network/browser.')
    }

    if (
      /\brename\s+all.*to\s+([^\s]+)\b/i.test(lower) &&
      /\b(?:unique|distinct)\s+(?:file)?name/i.test(lower)
    ) {
      conflicts.push('Request asks to rename all files to a uniform name while requiring all names to be distinct.')
    }

    if (conflicts.length > 0) {
      return {
        status: 'conflicting_requirements',
        confidence: 1.0,
        reason: `Detected conflicting requirements: ${conflicts.join(' ')}`,
        detectedConflicts: conflicts,
      }
    }
    return null
  }

  private checkUnsupportedDomain(raw: string, lower: string): WorkflowRouteResult | null {
    if (/\b(?:pizza|doordash|ubereats|grubhub|takeout|food\s+delivery|buy\s+a\s+pizza)\b/i.test(lower)) {
      return {
        status: 'unsupported',
        confidence: 0.95,
        reason: 'Food ordering and e-commerce transactions are outside usePilot capabilities.',
      }
    }

    if (/\b(?:outlook|send\s+(?:an?\s+)?email|compose\s+email|inbox|schedule\s+a?\s+meeting|slack\s+message)\b/i.test(lower)) {
      return {
        status: 'unsupported',
        confidence: 0.95,
        reason: 'Email client communication and calendar scheduling are outside usePilot capabilities.',
      }
    }

    if (/\b(?:transcribe|audio\s+podcast|subtitles|translate\s+speech|mp3\s+to\s+text)\b/i.test(lower)) {
      return {
        status: 'unsupported',
        confidence: 0.95,
        reason: 'Audio transcription and media translation are outside usePilot capabilities.',
      }
    }

    if (/\b(?:postgres|postgresql|mysql|database\s+migration|migration\s+queries|database\s+on\s+localhost)\b/i.test(lower)) {
      return {
        status: 'unsupported',
        confidence: 0.95,
        reason: 'Database server administration and SQL migrations are outside usePilot capabilities.',
      }
    }

    return null
  }

  private checkClarificationNeeded(
    raw: string,
    lower: string,
    signals: ReturnType<typeof extractPromptSignals>
  ): WorkflowRouteResult | null {
    const missing: string[] = []

    // 1. Web action without URL or site reference
    const referencesAbstractWeb =
      /\b(?:this\s+website|the\s+website|this\s+company|that\s+site)\b/i.test(lower) ||
      (/\b(?:download|research|browse)\b/i.test(lower) && /\b(?:website|site|company|page)\b/i.test(lower))

    if (referencesAbstractWeb && !signals.hasUrl) {
      missing.push('url')
    }

    // 2. Multi-step rename without target folder
    if (
      /\bfind\s+(?:all\s+)?matching\s+files\s+and\s+rename\b/i.test(lower) &&
      !/[a-zA-Z]:[/\\]|~\/|\b(?:in|folder|directory)\s+([a-zA-Z0-9_\-/]+)/i.test(raw)
    ) {
      missing.push('folder')
    }

    // 3. Multi-step download & organize without source or destination
    if (
      /\bdownload\s+all\s+documents\s+and\s+organize\b/i.test(lower) &&
      !signals.hasUrl
    ) {
      if (!missing.includes('url')) missing.push('url')
      if (!/[a-zA-Z]:[/\\]|~\/|\b(?:in|to|into|folder)\s+([a-zA-Z0-9_\-/]+)/i.test(raw)) {
        missing.push('folder')
      }
    }

    if (missing.length > 0) {
      return {
        status: 'requires_clarification',
        confidence: 0.85,
        reason: `Multi-step goal cannot be resolved without required parameter(s): ${missing.join(', ')}.`,
        missingInputs: missing,
      }
    }

    return null
  }

  private matchPredefinedComposition(
    raw: string,
    signals: ReturnType<typeof extractPromptSignals>
  ): { composition: SkillComposition; confidence: number } | null {
    const promptTokens = signals.normalizedTokens
    const compositions = this.compositionRegistry.list()

    let bestComp: SkillComposition | null = null
    let bestScore = 0

    for (const comp of compositions) {
      let maxCompScore = 0

      // Match against examples
      if (comp.examples && comp.examples.length > 0) {
        for (const ex of comp.examples) {
          const exTokens = tokenizeNormalized(ex)
          const overlap = computeTokenOverlap(promptTokens, exTokens)
          if (overlap > maxCompScore) maxCompScore = overlap
        }
      }

      // Match against tags
      if (comp.tags) {
        const tagOverlap = computeTokenOverlap(promptTokens, comp.tags.map((t) => t.toLowerCase()))
        if (tagOverlap * 0.7 > maxCompScore) maxCompScore = tagOverlap * 0.7
      }

      // Specific composition heuristics:
      // audit-and-clean-downloads: duplicate + organize
      if (comp.id === 'audit-and-clean-downloads' && signals.hasDuplicateSignal && signals.hasOrganizeSignal) {
        maxCompScore = Math.max(maxCompScore, 0.92)
      }

      // research-download-and-organize: research/web + download + organize
      const hasDownloadIntent =
        signals.hasDownloadSignal ||
        signals.hasWebDocumentSignal ||
        /\b(?:download|pull\s+down|fetch|save|grab|get)\s+(?:all\s+)?(?:the\s+)?(?:pdf|pdfs|reports|documents|files)\b/i.test(raw)
      const hasOrganizeIntent =
        signals.hasOrganizeSignal ||
        /\b(?:organize|organise|arrange|sort|tidy|subfolder|subfolders)\b/i.test(raw)
      const hasWebResearchIntent =
        signals.hasResearchSignal ||
        signals.hasUrl ||
        signals.hasWebKeyword

      if (comp.id === 'research-download-and-organize' && hasDownloadIntent && hasOrganizeIntent && hasWebResearchIntent) {
        maxCompScore = Math.max(maxCompScore, 0.94)
      }

      // find-and-rename: find + rename
      if (comp.id === 'find-and-rename' && signals.hasFindSignal && signals.hasRenameSignal) {
        maxCompScore = Math.max(maxCompScore, 0.90)
      }

      if (maxCompScore > bestScore) {
        bestScore = maxCompScore
        bestComp = comp
      }
    }

    if (bestComp && bestScore >= 0.70) {
      return { composition: bestComp, confidence: bestScore }
    }
    return null
  }

  private attemptDynamicComposition(
    raw: string,
    _signals: ReturnType<typeof extractPromptSignals>
  ): WorkflowRouteResult | null {
    // Check for temporal sequence connectors
    const connectorPattern = /\b(?:and\s+then|then|after\s+that|followed\s+by|afterward|next)\b/i
    if (!connectorPattern.test(raw)) return null

    const clauses = raw.split(connectorPattern).map((c) => c.trim()).filter((c) => c.length > 0)
    if (clauses.length < 2) return null

    const orderedSkills: Array<{ id: string; name: string }> = []

    for (const clause of clauses) {
      const candidates = this.discovery.discover({ userPrompt: clause })
      if (candidates.length > 0 && candidates[0]!.score >= 0.35) {
        const candidate = candidates[0]!
        // Avoid consecutive duplicate skills
        if (orderedSkills.length === 0 || orderedSkills[orderedSkills.length - 1]!.id !== candidate.skillId) {
          orderedSkills.push({ id: candidate.skillId, name: candidate.name })
        }
      }
    }

    if (orderedSkills.length >= 2) {
      const skillIds = orderedSkills.map((s) => s.id)

      // Check if this matches a predefined composition's exact skill sequence
      for (const comp of this.compositionRegistry.list()) {
        const compStepSkills = comp.steps.map((st) => st.skillId)
        if (
          compStepSkills.length === skillIds.length &&
          compStepSkills.every((id, idx) => id === skillIds[idx])
        ) {
          return {
            status: 'matched_composition',
            composition: comp,
            confidence: 0.90,
            reason: `Dynamic sequence matches predefined composition "${comp.name}" (${comp.id}).`,
          }
        }
      }

      // Novel sequence -> dynamically construct SkillComposition
      const dynamicComp: SkillComposition = {
        id: `dynamic-${skillIds.join('-to-')}`,
        name: `Dynamic Workflow: ${orderedSkills.map((s) => s.name).join(' → ')}`,
        description: `Dynamically composed workflow from goal: "${raw}"`,
        version: '1.0.0',
        steps: skillIds.map((id, idx) => ({
          stepId: `step-${idx + 1}-${id}`,
          skillId: id,
          inputBindings: {},
        })),
      }

      const validation = this.validator.validate(dynamicComp)
      if (validation.valid) {
        return {
          status: 'dynamic_composition',
          composition: dynamicComp,
          confidence: 0.85,
          reason: `Dynamically composed valid ${orderedSkills.length}-step workflow across skills: ${skillIds.join(' → ')}.`,
          suggestedSteps: skillIds,
        }
      }
    }

    return null
  }
}
