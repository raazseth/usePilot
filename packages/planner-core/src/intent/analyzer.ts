// ─────────────────────────────────────────────────────────────────────────────
// IntentAnalyzer
// Classifies the Goal into an intent type, risk level, and complexity.
// Context-aware — receives PlannerContext so it can tailor its assessment
// to the user's available tools and platform.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import type { Goal, Intent, PlannerContext } from '@usepilot/planner-types'
import type { AIProvider, ChatRequest } from '@usepilot/ai-core'
import { PlannerError } from '../errors'

const MAX_RETRIES = 3

// ── Zod schema ────────────────────────────────────────────────────────────────

const IntentResponseSchema = z.object({
  type: z.enum(['browser', 'desktop', 'filesystem', 'email', 'research', 'mixed', 'unknown']),
  subTypes: z.array(z.enum(['browser', 'desktop', 'filesystem', 'email', 'research', 'mixed', 'unknown'])).optional(),
  riskLevel: z.enum(['low', 'medium', 'high', 'critical']),
  complexity: z.enum(['low', 'medium', 'high', 'unknown']),
  requiresHumanApproval: z.boolean(),
  missingInformation: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1),
})

type IntentResponse = z.infer<typeof IntentResponseSchema>

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an intent analyzer for an AI task automation assistant.
Given a user's goal, classify the type of automation required.

Intent types:
- browser: requires web browsing, form filling, or web scraping
- desktop: requires controlling desktop applications (non-browser)
- filesystem: requires reading, writing, organizing, or moving files
- email: requires sending, reading, or organizing emails
- research: requires searching and synthesizing information
- mixed: requires multiple tool types

Risk levels:
- low: reversible actions, no sensitive data, no external services
- medium: modifies files/settings, sends data to external services
- high: irreversible actions, large file deletions, financial transactions
- critical: system-level changes, credentials, large payments

Complexity:
- low: 1-3 tasks, single tool, linear
- medium: 4-8 tasks, possibly multiple tools, some branching
- high: 9+ tasks, multiple tools, conditional logic

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation.`

function buildPrompt(goal: Goal, ctx: PlannerContext, previousErrors: string[]): string {
  const toolsStr = ctx.availableTools.join(', ')
  const platformStr = ctx.platform
  let prompt = `Analyze this goal:
Primary objective: "${goal.primaryObjective}"
Expected outcome: "${goal.expectedOutcome}"
Constraints: ${goal.constraints.join(', ') || 'none'}
Required resources: ${goal.requiredResources.join(', ') || 'unknown'}
User platform: ${platformStr}
Available tools: ${toolsStr}`

  if (previousErrors.length > 0) {
    prompt += `\n\nPrevious response was invalid. Errors:\n${previousErrors.join('\n')}\nPlease correct and return valid JSON.`
  }
  return prompt
}

// ── IntentAnalyzer class ──────────────────────────────────────────────────────

export class IntentAnalyzer {
  constructor(private readonly provider: AIProvider) {}

  async analyze(goal: Goal, context: PlannerContext, model: string): Promise<Intent> {
    const start = Date.now()
    let lastError: unknown
    let previousErrors: string[] = []

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const request: ChatRequest = {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(goal, context, previousErrors) },
          ],
          model,
          temperature: 0.1,
          maxTokens: 400,
          providerOptions: { format: 'json' },
        }

        const response = await this.provider.chat(request)
        const parsed = this.parseResponse(response.content)

        if (parsed.success) {
          return this.toIntent(parsed.data, Date.now() - start)
        }

        previousErrors = parsed.errors
        lastError = new Error(parsed.errors.join('; '))
      } catch (err) {
        lastError = err
        previousErrors = [err instanceof Error ? err.message : String(err)]
      }
    }

    throw PlannerError.llmRetryExhausted('analyzing', MAX_RETRIES, lastError)
  }

  private parseResponse(
    content: string
  ): { success: true; data: IntentResponse } | { success: false; errors: string[] } {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch?.[0]) {
      return { success: false, errors: ['Response does not contain a JSON object'] }
    }
    let raw: unknown
    try {
      raw = JSON.parse(jsonMatch[0])
    } catch (e) {
      return { success: false, errors: [`Invalid JSON: ${e instanceof Error ? e.message : String(e)}`] }
    }
    const result = IntentResponseSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  private toIntent(data: IntentResponse, durationMs: number): Intent {
    return {
      type: data.type,
      subTypes: data.subTypes,
      riskLevel: data.riskLevel,
      complexity: data.complexity,
      requiresHumanApproval: data.requiresHumanApproval,
      missingInformation: data.missingInformation,
      confidence: data.confidence,
      durationMs,
    }
  }
}
