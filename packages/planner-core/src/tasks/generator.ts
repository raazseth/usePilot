// ─────────────────────────────────────────────────────────────────────────────
// TaskGenerator
// Converts a Goal + Intent into an ordered list of atomic Tasks.
// Each task is one operation, one tool.
// Assigns: requiredTool, preconditions, postconditions, approvalPolicy,
//          complexity, successConditions, failureConditions, retryPolicy.
// ─────────────────────────────────────────────────────────────────────────────

import { z } from 'zod'
import type { Goal, Intent, Task, PlannerContext } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'
import type { AIProvider, ChatRequest } from '@usepilot/ai-core'
import { PlannerError } from '../errors'

const MAX_RETRIES = 3

// ── Zod schema for a single task in the LLM response ──────────────────────────

const TaskResponseSchema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(10),
  category: z.enum([
    'navigation', 'extraction', 'creation', 'modification', 'deletion',
    'communication', 'verification', 'computation', 'organization', 'other',
  ]),
  requiredTool: z.enum(['browser', 'filesystem', 'email', 'terminal', 'clipboard', 'api', 'none']),
  toolConfig: z.record(z.unknown()).optional(),
  preconditions: z.array(z.string()).default([]),
  postconditions: z.array(z.string()).default([]),
  successConditions: z.array(z.string()).min(1, 'Each task must have at least one success condition'),
  failureConditions: z.array(z.string()).default([]),
  dependsOn: z.array(z.string()).default([]),
  complexity: z.enum(['low', 'medium', 'high', 'unknown']).default('medium'),
})

const TaskListResponseSchema = z.object({
  tasks: z.array(TaskResponseSchema).min(1, 'Plan must have at least one task'),
})

type TaskListResponse = z.infer<typeof TaskListResponseSchema>

// ── Prompt ────────────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a task generation system for an AI automation assistant.
Break down a user's goal into a list of atomic tasks.

ATOMICITY RULE: Each task must be exactly ONE operation using ONE tool.
BAD: "Download and organize invoices" (two operations)
GOOD: Task 1 "Navigate to invoice download page" + Task 2 "Download invoice file"

For each task you must provide:
- title: imperative verb phrase (max 80 chars)
- description: what this task does and why
- category: one of [navigation, extraction, creation, modification, deletion, communication, verification, computation, organization, other]
- requiredTool: one of [browser, filesystem, email, terminal, clipboard, api, none]
- toolConfig: tool-specific configuration (optional object)
- preconditions: what must be true BEFORE this task runs
- postconditions: what will be true AFTER this task succeeds
- successConditions: measurable conditions that confirm success (REQUIRED, min 1)
- failureConditions: conditions that indicate failure
- dependsOn: array of task titles that must complete first (use exact titles)
- complexity: one of [low, medium, high, unknown]

Return ONLY a JSON object: {"tasks": [...]}. No markdown.`

function buildPrompt(
  goal: Goal,
  intent: Intent,
  ctx: PlannerContext,
  previousErrors: string[]
): string {
  const toolsStr = ctx.availableTools.join(', ')
  let prompt = `Generate tasks for this goal:
Objective: "${goal.primaryObjective}"
Expected outcome: "${goal.expectedOutcome}"
Intent type: ${intent.type}
Risk level: ${intent.riskLevel}
Platform: ${ctx.platform}
Available tools: ${toolsStr}
Constraints: ${goal.constraints.join(', ') || 'none'}`

  if (ctx.previousBlueprints.length > 0) {
    const prev = ctx.previousBlueprints.slice(0, 3).map((b) => b.primaryObjective).join('; ')
    prompt += `\nUser's previous plans (for context): ${prev}`
  }

  if (previousErrors.length > 0) {
    prompt += `\n\nPrevious response was invalid. Errors:\n${previousErrors.join('\n')}\nPlease correct and return valid JSON.`
  }
  return prompt
}

// ── TaskGenerator class ───────────────────────────────────────────────────────

export class TaskGenerator {
  constructor(private readonly provider: AIProvider) {}

  async generate(goal: Goal, intent: Intent, context: PlannerContext, model: string): Promise<Task[]> {
    let lastError: unknown
    let previousErrors: string[] = []

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const request: ChatRequest = {
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: buildPrompt(goal, intent, context, previousErrors) },
          ],
          model,
          temperature: 0.2,
          maxTokens: 2000,
          providerOptions: { format: 'json' },
        }

        const response = await this.provider.chat(request)
        const parsed = this.parseResponse(response.content)

        if (parsed.success) {
          return this.toTasks(parsed.data)
        }

        previousErrors = parsed.errors
        lastError = new Error(parsed.errors.join('; '))
      } catch (err) {
        lastError = err
        previousErrors = [err instanceof Error ? err.message : String(err)]
      }
    }

    throw PlannerError.llmRetryExhausted('generating', MAX_RETRIES, lastError)
  }

  private parseResponse(
    content: string
  ): { success: true; data: TaskListResponse } | { success: false; errors: string[] } {
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
    const result = TaskListResponseSchema.safeParse(raw)
    if (result.success) return { success: true, data: result.data }
    return { success: false, errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }

  private toTasks(data: TaskListResponse): Task[] {
    // First pass: assign IDs, map title → ID for dependency resolution
    const titleToId = new Map<string, string>()
    const ids = data.tasks.map(() => generateId())
    data.tasks.forEach((t, i) => {
      titleToId.set(t.title, ids[i] ?? '')
    })

    return data.tasks.map((t, i) => ({
      id: ids[i] ?? generateId(),
      title: t.title,
      description: t.description,
      category: t.category,
      requiredTool: t.requiredTool,
      toolConfig: t.toolConfig,
      preconditions: t.preconditions,
      postconditions: t.postconditions,
      successConditions: t.successConditions,
      failureConditions: t.failureConditions,
      // Resolve title, index, or ID references to generated IDs
      dependsOn: t.dependsOn
        .map((dep) => {
          if (titleToId.has(dep)) return titleToId.get(dep)!
          if (ids.includes(dep)) return dep
          const match = dep.match(/^(?:task_)?(\d+)$/i)
          if (match && match[1]) {
            const idx = parseInt(match[1], 10)
            if (ids[idx]) return ids[idx]!
          }
          return ''
        })
        .filter((id) => id !== ''),
      approvalPolicy: 'automatic' as const, // ApprovalEngine sets this later
      complexity: t.complexity,
      retryPolicy: { maxAttempts: 3, backoffMs: 1000, exponential: true },
      failureStrategy: { onFailure: 'abort' as const },
      confidence: 0.8, // default; optimizer can adjust
    }))
  }
}
