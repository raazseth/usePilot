// GoalExtractor

import { z } from 'zod'
import type { Goal, NormalizedInput, GoalConstraint } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'
import type { AIProvider, ChatRequest } from '@usepilot/ai-core'
import { PlannerError, PlannerErrorCode } from '../errors'

const MAX_RETRIES = 3

// Zod schema for the LLM response

const GoalConstraintSchema = z.object({
  type: z.enum(['budget', 'temporal', 'location', 'format', 'security', 'preference', 'custom']).default('custom'),
  key: z.string(),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional(),
  isHardConstraint: z.boolean().default(true),
})

const GoalResponseSchema = z.object({
  primaryObjective: z.string().min(10, 'Primary objective must be at least 10 characters'),
  constraints: z.array(z.union([z.string(), GoalConstraintSchema])).default([]),
  requiredResources: z.array(z.string()).default([]),
  expectedOutcome: z.string().min(5, 'Expected outcome must be at least 5 characters'),
  context: z.string().optional(),
  confidence: z.number().min(0).max(1),
})

type GoalResponse = z.infer<typeof GoalResponseSchema>

// Prompt templates

const SYSTEM_PROMPT = `You are a goal extraction system for an AI task automation assistant.
Your job is to extract the user's objective as structured JSON.

Rules:
- primaryObjective: Clear, specific statement of what needs to be done. No vague language.
- constraints: Explicit limits mentioned by the user (e.g. "only free tools", "before Friday").
- requiredResources: Websites, files, apps, accounts, or data the task needs.
- expectedOutcome: Concrete description of what success looks like.
- context: Optional background information the user provided.
- confidence: How confident you are in the extraction (0.0 to 1.0).

IMPORTANT: Return ONLY valid JSON. No markdown, no explanation, no code fences.`

function buildUserPrompt(normalizedText: string, previousErrors: string[]): string {
  let prompt = `Extract the goal from this input:\n"${normalizedText}"`
  if (previousErrors.length > 0) {
    prompt += `\n\nYour previous response was invalid. Errors:\n${previousErrors.join('\n')}\nPlease correct these issues and return valid JSON.`
  }
  return prompt
}

// GoalExtractor class

export class GoalExtractor {
  constructor(private readonly provider: AIProvider) {}

  async extract(normalizedInput: NormalizedInput, model: string): Promise<Goal> {
    const start = Date.now()
    let lastError: unknown
    let previousErrors: string[] = []

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const request: ChatRequest = {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildUserPrompt(normalizedInput.text, previousErrors) },
          ],
          model,
          temperature: 0.1,
          maxTokens: 600,
          providerOptions: { format: 'json' },
        }

        const response = await this.provider.chat(request)
        const parsed = this.parseResponse(response.content)

        if (parsed.success) {
          const now = Date.now()
          return this.toGoal(parsed.data, normalizedInput, now - start)
        }

        // Collect Zod errors and inject into next attempt
        previousErrors = parsed.errors
        lastError = new Error(parsed.errors.join('; '))
      } catch (err) {
        lastError = err
        previousErrors = [err instanceof Error ? err.message : String(err)]
      }
    }

    throw PlannerError.llmRetryExhausted('extracting', MAX_RETRIES, lastError)
  }

  private parseResponse(
    content: string
  ): { success: true; data: GoalResponse } | { success: false; errors: string[] } {
    // Extract JSON from the response (handles accidental markdown wrapping)
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

    const result = GoalResponseSchema.safeParse(raw)
    if (result.success) {
      return { success: true, data: result.data }
    }

    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)
    return { success: false, errors }
  }

  private toGoal(
    data: GoalResponse,
    normalizedInput: NormalizedInput,
    _durationMs: number
  ): Goal {
    const constraints: GoalConstraint[] = data.constraints.map((c) => {
      if (typeof c === 'object' && c !== null) {
        return {
          id: generateId(),
          type: c.type ?? 'custom',
          key: c.key || 'constraint',
          value: c.value,
          unit: c.unit,
          isHardConstraint: c.isHardConstraint ?? true,
        }
      }
      return {
        id: generateId(),
        type: 'custom',
        key: 'constraint',
        value: String(c),
        isHardConstraint: true,
      }
    })

    return {
      id: generateId(),
      primaryObjective: data.primaryObjective,
      constraints,
      rawConstraints: data.constraints.map((c) => (typeof c === 'string' ? c : `${c.key}: ${c.value}`)),
      requiredResources: data.requiredResources,
      expectedOutcome: data.expectedOutcome,
      context: data.context,
      confidence: data.confidence,
      normalizedInput,
      status: 'validated',
      createdAt: Date.now(),
    }
  }
}
