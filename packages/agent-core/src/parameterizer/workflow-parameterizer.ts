import type { AgentGoal } from '@usepilot/agent-types'
import type { SkillComposition } from '@usepilot/skill-types'

import type { RetrievedAgentContext } from '../context/agent-context-facade'

export interface ParameterizationResult {
  inputs: Record<string, unknown>
  missingRequired: string[]
  parameterSources: Record<string, 'explicit_input' | 'extracted' | 'runtime_context' | 'preference' | 'default'>
}

/**
 * AgentWorkflowParameterizer — Binds parameters according to strict priority:
 *
 * Explicit User Input > Extracted Parameters > Runtime Context > Validated Memory/Preferences > Safe Defaults
 *
 * Invariant: Never allow memory or preferences to silently override explicit user input.
 * Invariant: Never fabricate parameters or use an unsafe default to avoid clarification.
 */
export class AgentWorkflowParameterizer {
  parameterize(
    goal: AgentGoal,
    composition: SkillComposition,
    context?: RetrievedAgentContext
  ): ParameterizationResult {
    const raw = goal.rawInput
    const lower = raw.toLowerCase()
    const inputs: Record<string, unknown> = {}
    const parameterSources: Record<string, 'explicit_input' | 'extracted' | 'runtime_context' | 'preference' | 'default'> = {}
    const missingRequired: string[] = []

    // 1. Extract Explicit / In-Prompt Parameters
    // URL extraction
    const urlMatch = raw.match(/https?:\/\/[^\s"',]+/)
    if (urlMatch) {
      inputs['url'] = urlMatch[0]
      parameterSources['url'] = 'explicit_input'
    }

    // Path / Folder extraction
    const winPathMatch = raw.match(/(?<![a-zA-Z0-9])([a-zA-Z]:[/\\](?:[^\\/:*?"<>|\r\n\s,]+[/\\])*[^\\/:*?"<>|\r\n\s,]*)/)
    const tildeMatch = raw.match(/~[/\\][^\s"',,]+/)
    const prepFolderMatch = raw.match(/\b(?:in|into|to|inside)\s+([a-zA-Z0-9_\-./\\]+)/i)
    const isDownloads = /\bdownloads\b/i.test(raw)

    if (winPathMatch) {
      const rawPath = winPathMatch[1] ?? winPathMatch[0]
      const cleanPath = rawPath.replace(/[,.;]+$/, '').trim()
      inputs['folder'] = cleanPath
      inputs['destinationFolder'] = cleanPath
      inputs['directory'] = cleanPath
      parameterSources['folder'] = 'explicit_input'
      parameterSources['destinationFolder'] = 'explicit_input'
      parameterSources['directory'] = 'explicit_input'
    } else if (tildeMatch) {
      const cleanPath = tildeMatch[0].replace(/[,.;]+$/, '').trim()
      inputs['folder'] = cleanPath
      inputs['destinationFolder'] = cleanPath
      inputs['directory'] = cleanPath
      parameterSources['folder'] = 'explicit_input'
      parameterSources['destinationFolder'] = 'explicit_input'
      parameterSources['directory'] = 'explicit_input'
    } else if (prepFolderMatch && prepFolderMatch[1] && !/^(?:all|the|my|this|an?|folders?|files?|categories|extension|type)$/i.test(prepFolderMatch[1])) {
      const captured = prepFolderMatch[1].replace(/[,.;]+$/, '').trim()
      inputs['folder'] = captured
      inputs['destinationFolder'] = captured
      inputs['directory'] = captured
      parameterSources['folder'] = 'extracted'
      parameterSources['destinationFolder'] = 'extracted'
      parameterSources['directory'] = 'extracted'
    } else if (isDownloads) {
      inputs['folder'] = '~/Downloads'
      inputs['destinationFolder'] = '~/Downloads'
      inputs['directory'] = '~/Downloads'
      parameterSources['folder'] = 'extracted'
      parameterSources['destinationFolder'] = 'extracted'
      parameterSources['directory'] = 'extracted'
    }

    // Pattern & Prefix extraction
    const prefixMatch = raw.match(/\b([a-zA-Z0-9_]+)_(?:prefix)?\b/i) || raw.match(/\bwith\s+(?:an?\s+)?([a-zA-Z0-9_]+)\s+prefix\b/i)
    if (prefixMatch && prefixMatch[1]) {
      const prefix = prefixMatch[1].endsWith('_') ? prefixMatch[1] : `${prefixMatch[1]}_`
      inputs['renamePattern'] = '{index}_'
      inputs['replacement'] = prefix
      inputs['pattern'] = prefix
      parameterSources['renamePattern'] = 'extracted'
      parameterSources['replacement'] = 'extracted'
    }

    const extMatch = raw.match(/\.(pdf|txt|csv|png|jpg|docx?|xlsx?)\b/i)
    if (extMatch && extMatch[1]) {
      inputs['extension'] = `.${extMatch[1]}`
      inputs['fileExtension'] = `.${extMatch[1]}`
      parameterSources['extension'] = 'extracted'
      parameterSources['fileExtension'] = 'extracted'
    }

    // 2. Runtime Context Fallback (Hot Context)
    if (!inputs['url'] && context?.hot.activeUrl && /\b(?:this\s+site|this\s+page|here|current\s+page)\b/i.test(lower)) {
      inputs['url'] = context.hot.activeUrl
      parameterSources['url'] = 'runtime_context'
    }

    if (!inputs['folder'] && context?.hot.currentFolder && /\b(?:this\s+folder|here|current\s+dir)\b/i.test(lower)) {
      inputs['folder'] = context.hot.currentFolder
      inputs['destinationFolder'] = context.hot.currentFolder
      parameterSources['folder'] = 'runtime_context'
    }

    // 3. Validated Preferences Fallback (Cold Context)
    const coldReportsFolder = context?.cold.userPreferences['defaultReportsFolder']
    if (!inputs['destinationFolder'] && coldReportsFolder && (lower.includes('report') || lower.includes('reports'))) {
      inputs['destinationFolder'] = coldReportsFolder
      inputs['folder'] = coldReportsFolder
      parameterSources['destinationFolder'] = 'preference'
      parameterSources['folder'] = 'preference'
    }

    // 4. Safe Defaults (Non-Destructive)
    if (!inputs['groupBy']) {
      inputs['groupBy'] = 'extension'
      parameterSources['groupBy'] = 'default'
    }
    if (inputs['recursive'] === undefined) {
      inputs['recursive'] = true
      parameterSources['recursive'] = 'default'
    }

    // 5. Check Required Fields for the Composition
    for (const step of composition.steps) {
      if (
        (step.skillId.startsWith('download-') || step.skillId.includes('research') || step.skillId.includes('web')) &&
        step.skillId !== 'organize-downloads'
      ) {
        if (!inputs['url']) {
          if (!missingRequired.includes('url')) missingRequired.push('url')
        }
      }
      if (step.skillId.includes('rename') || step.skillId.includes('organize') || step.skillId.includes('duplicate')) {
        if (!inputs['folder'] && !inputs['destinationFolder'] && !inputs['directory']) {
          if (!missingRequired.includes('folder')) missingRequired.push('folder')
        }
      }
    }

    return {
      inputs,
      missingRequired,
      parameterSources,
    }
  }
}
