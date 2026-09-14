import type { AgentGoal, AgentConfidence, AgentRiskLevel } from '@usepilot/agent-types'
import { extractPromptSignals, tokenizeNormalized } from '@usepilot/skill-core'
import { generateId } from '@usepilot/utils'

import type { RetrievedAgentContext } from '../context/agent-context-facade'

/**
 * Prompt injection patterns commonly embedded in adversarial web pages or documents.
 * In usePilot, external content is strictly DATA, never INSTRUCTION.
 */
const INJECTION_PATTERNS = [
  /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions/i,
  /disregard\s+(?:all\s+)?(?:safety|system|user)\s+(?:rules|policies|instructions)/i,
  /system\s+update\s*:\s*(?:delete|override|format|execute)/i,
  /you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted\s+assistant|unrestricted|in\s+developer\s+mode|dan)/i,
  /override\s+(?:user\s+)?(?:instruction|goal|intent)/i,
  /new\s+system\s+directive\s*:/i,
]

export class AgentGoalAnalyzer {
  /**
   * Evaluates untrusted external content (e.g. from web page scraping or file reading)
   * to detect prompt injection attempts.
   */
  isPromptInjection(text: string): boolean {
    return INJECTION_PATTERNS.some((pat) => pat.test(text))
  }

  /**
   * Sanitizes external content by nullifying adversarial command structures,
   * preserving only factual data for downstream skills.
   */
  sanitizeExternalData(untrustedText: string): { sanitized: string; injectionDetected: boolean } {
    let injectionDetected = false
    let sanitized = untrustedText

    for (const pat of INJECTION_PATTERNS) {
      if (pat.test(sanitized)) {
        injectionDetected = true
        sanitized = sanitized.replace(pat, '[UNTRUSTED_EXTERNAL_DIRECTIVE_STRIPPED]')
      }
    }

    return { sanitized, injectionDetected }
  }

  /**
   * Normalizes and analyzes a natural language user objective into an AgentGoal.
   */
  analyze(rawInput: string, context?: RetrievedAgentContext): AgentGoal {
    const trimmed = rawInput.trim()
    const lower = trimmed.toLowerCase()
    const signals = extractPromptSignals(trimmed)
    const tokens = tokenizeNormalized(trimmed)

    const constraints: string[] = []
    const requiredInformation: string[] = []
    const missingInformation: string[] = []
    const contextReferences: string[] = []

    // 1. Constraint Extraction
    if (/\bdon'?t\s+delete\b/i.test(lower)) {
      constraints.push('do_not_delete')
    }
    if (/\bwithout\s+(?:using\s+)?(?:an?\s+)?(?:internet|browser)\b/i.test(lower)) {
      constraints.push('offline_only')
    }
    if (/\bunique\b/i.test(lower)) {
      constraints.push('require_unique_names')
    }

    // 2. Intent & Desired Outcome
    let intent = 'general_task'
    let desiredOutcome = 'Execute requested actions'

    if (signals.hasDuplicateSignal && signals.hasOrganizeSignal) {
      intent = 'audit_and_clean'
      desiredOutcome = 'Detect duplicate files and organize remaining files into categories'
      requiredInformation.push('folder')
    } else if (signals.hasDownloadSignal && signals.hasOrganizeSignal) {
      intent = 'download_and_organize'
      desiredOutcome = 'Download documents from web source and organize them on local disk'
      requiredInformation.push('url', 'folder')
    } else if (signals.hasFindSignal && signals.hasRenameSignal) {
      intent = 'find_and_rename'
      desiredOutcome = 'Find matching files and rename them according to pattern'
      requiredInformation.push('folder', 'renamePattern')
    } else if (signals.hasResearchSignal && signals.hasDownloadSignal) {
      intent = 'research_and_download'
      desiredOutcome = 'Research target company/site and download findings/reports'
      requiredInformation.push('url')
    } else if (signals.hasResearchSignal) {
      intent = 'research_website'
      desiredOutcome = 'Analyze website content and extract summary'
      requiredInformation.push('url')
    } else if (signals.hasDownloadSignal) {
      intent = 'download_documents'
      desiredOutcome = 'Download files from website'
      requiredInformation.push('url')
    } else if (signals.hasOrganizeSignal) {
      intent = 'organize_files'
      desiredOutcome = 'Sort files in folder by type'
      requiredInformation.push('folder')
    } else if (signals.hasDuplicateSignal) {
      intent = 'detect_duplicates'
      desiredOutcome = 'Scan folder for duplicate files'
      requiredInformation.push('folder')
    } else if (signals.hasFindSignal) {
      intent = 'find_files'
      desiredOutcome = 'Locate files in directory'
      requiredInformation.push('folder')
    }

    // 3. Resolve Missing Information against Context
    for (const req of requiredInformation) {
      if (req === 'url') {
        if (!signals.hasUrl) {
          // Check hot context for active URL
          if (context?.hot.activeUrl && (/\b(?:this\s+page|current\s+tab|this\s+website|this\s+site|here)\b/i.test(lower) || !signals.hasUrl)) {
            contextReferences.push(`hot:activeUrl=${context.hot.activeUrl}`)
          } else {
            missingInformation.push('url')
          }
        }
      } else if (req === 'folder' || req === 'destinationFolder') {
        const hasPathInPrompt = /[a-zA-Z]:[/\\]|~\/|\b(?:in|folder|directory)\s+([a-zA-Z0-9_\-/]+)/i.test(trimmed)
        if (!hasPathInPrompt) {
          // Check context for default download/working folder
          const defaultReportsFolder = context?.cold.userPreferences['defaultReportsFolder']
          if (defaultReportsFolder && (intent.includes('report') || /\breports?\b/i.test(lower))) {
            contextReferences.push(`cold:defaultReportsFolder=${defaultReportsFolder}`)
          } else if (context?.hot.currentFolder && /\b(?:this\s+folder|here|current\s+directory)\b/i.test(lower)) {
            contextReferences.push(`hot:currentFolder=${context.hot.currentFolder}`)
          } else if (/\bdownloads\b/i.test(lower)) {
            // "Downloads" folder explicitly named in prompt
          } else {
            missingInformation.push(req)
          }
        }
      }
    }

    // 4. Risk Level Calculation
    let riskLevel: AgentRiskLevel = 'low'
    if (
      /c:[/\\]windows/i.test(trimmed) ||
      /system32/i.test(trimmed) ||
      /\bformat\s+(?:drive\s+)?[a-z]:/i.test(lower) ||
      /\bwipe\s+(?:entire\s+)?hard\s+drive/i.test(lower) ||
      /\bdelete\s+(?:all\s+)?system\s+files/i.test(lower)
    ) {
      riskLevel = 'critical'
    } else if (/\bdelete\b/i.test(lower) || /\bremove\s+all\b/i.test(lower)) {
      riskLevel = 'high'
    } else if (signals.hasRenameSignal || signals.hasOrganizeSignal) {
      riskLevel = 'medium'
    }

    // 5. Confidence Calculation
    let confidence: AgentConfidence = 'HIGH'
    if (missingInformation.length > 0) {
      confidence = 'LOW'
    } else if (tokens.length < 3 || intent === 'general_task') {
      confidence = 'MEDIUM'
    }

    return {
      id: `goal-${generateId()}`,
      rawInput: trimmed,
      normalizedGoal: trimmed.replace(/\s+/g, ' '),
      intent,
      desiredOutcome,
      constraints,
      preferences: context?.cold.userPreferences,
      requiredInformation,
      missingInformation,
      riskLevel,
      confidence,
      contextReferences: contextReferences.length > 0 ? contextReferences : undefined,
    }
  }
}
