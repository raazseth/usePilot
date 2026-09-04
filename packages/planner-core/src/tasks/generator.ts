// TaskGenerator

import { z } from 'zod'
import type { Goal, Intent, Task, TaskCapability, TaskTool, TaskCategory, PlannerContext } from '@usepilot/planner-types'
import { generateId } from '@usepilot/utils'
import type { AIProvider, ChatRequest } from '@usepilot/ai-core'
import { PlannerError } from '../errors'

const MAX_RETRIES = 3

// Zod schema for a single task in the LLM response

const TaskCapabilityEnum = z.enum([
  'navigate_website',
  'download_file',
  'read_file',
  'write_file',
  'move_file',
  'delete_file',
  'search_web',
  'extract_web_data',
  'authenticate_user',
  'send_communication',
  'read_communication',
  'execute_command',
  'read_clipboard',
  'write_clipboard',
  'call_api',
  'transform_data',
  'verify_state',
  'none',
])

const TaskResponseSchema = z.object({
  title: z.string().min(5).max(80),
  description: z.string().min(10),
  category: z.enum([
    'navigation', 'extraction', 'creation', 'modification', 'deletion',
    'communication', 'verification', 'computation', 'organization', 'other',
  ]),
  requiredCapability: TaskCapabilityEnum.optional(),
  requiredTool: z.enum(['browser', 'filesystem', 'email', 'terminal', 'clipboard', 'api', 'none']).optional(),
  suggestedTool: z.string().optional(),
  expectedOutput: z.string().optional(),
  isOptional: z.boolean().default(false),
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

// Prompt

const SYSTEM_PROMPT = `You are a task generation system for an AI automation assistant.
Break down a user's goal into a list of atomic tasks.

ATOMICITY RULE: Each task must be exactly ONE operation demanding ONE capability.
BAD: "Download and organize invoices" (two operations)
GOOD: Task 1 "Navigate to invoice download page" + Task 2 "Download invoice file"

For each task you must provide:
- title: imperative verb phrase (max 80 chars)
- description: what this task does and why
- category: one of [navigation, extraction, creation, modification, deletion, communication, verification, computation, organization, other]
- requiredCapability: one of [navigate_website, download_file, read_file, write_file, move_file, delete_file, search_web, extract_web_data, authenticate_user, send_communication, read_communication, execute_command, read_clipboard, write_clipboard, call_api, transform_data, verify_state, none]
- suggestedTool: optional runner hint (e.g. playwright, chrome-extension, filesystem)
- expectedOutput: what concrete artifact or result is produced (e.g. "PDF file saved", "Session active")
- isOptional: true if this step is optional for goal fulfillment
- toolConfig: capability-specific configuration (optional object)
- preconditions: what must be true BEFORE this task runs
- postconditions: what will be true AFTER this task succeeds
- successConditions: measurable conditions that confirm success (REQUIRED, min 1)
- failureConditions: conditions that indicate failure
- dependsOn: array of predecessor task titles that must complete first (use exact titles)
- complexity: one of [low, medium, high, unknown]

Return ONLY a JSON object: {"tasks": [...]}. No markdown.`

function buildPrompt(
  goal: Goal,
  intent: Intent,
  ctx: PlannerContext,
  previousErrors: string[]
): string {
  const toolsStr = ctx.availableCapabilities?.length
    ? ctx.availableCapabilities.join(', ')
    : ctx.availableTools.join(', ')

  const constraintsStr = Array.isArray(goal.constraints) && goal.constraints.length > 0
    ? goal.constraints.map((c) => typeof c === 'string' ? c : `${c.key}: ${c.value} (${c.type})`).join(', ')
    : (goal.rawConstraints?.join(', ') || 'none')

  let prompt = `Generate tasks for this goal:
Objective: "${goal.primaryObjective}"
Expected outcome: "${goal.expectedOutcome}"
Intent type: ${intent.type}
Risk level: ${intent.riskLevel}
Platform: ${ctx.platform}
Available capabilities/tools: ${toolsStr}
Constraints: ${constraintsStr}`

  if (ctx.previousBlueprints.length > 0) {
    const prev = ctx.previousBlueprints.slice(0, 3).map((b) => b.primaryObjective).join('; ')
    prompt += `\nUser's previous plans (for context): ${prev}`
  }

  if (previousErrors.length > 0) {
    prompt += `\n\nPrevious response was invalid. Errors:\n${previousErrors.join('\n')}\nPlease correct and return valid JSON.`
  }
  return prompt
}

function resolveCapability(
  cap?: TaskCapability,
  tool?: TaskTool,
  category?: TaskCategory
): TaskCapability {
  if (cap) return cap

  if (tool) {
    switch (tool) {
      case 'browser':
        return category === 'extraction' ? 'extract_web_data' : 'navigate_website'
      case 'filesystem':
        if (category === 'deletion') return 'delete_file'
        if (category === 'creation') return 'write_file'
        if (category === 'organization') return 'move_file'
        return 'read_file'
      case 'email':
        return category === 'extraction' ? 'read_communication' : 'send_communication'
      case 'terminal':
        return 'execute_command'
      case 'clipboard':
        return category === 'creation' ? 'write_clipboard' : 'read_clipboard'
      case 'api':
        return 'call_api'
      case 'none':
        return 'none'
    }
  }

  switch (category) {
    case 'navigation':
      return 'navigate_website'
    case 'extraction':
      return 'extract_web_data'
    case 'creation':
      return 'write_file'
    case 'deletion':
      return 'delete_file'
    case 'communication':
      return 'send_communication'
    case 'verification':
      return 'verify_state'
    case 'computation':
      return 'transform_data'
    case 'organization':
      return 'move_file'
    default:
      return 'none'
  }
}

function capabilityToTool(cap: TaskCapability): TaskTool {
  switch (cap) {
    case 'navigate_website':
    case 'search_web':
    case 'extract_web_data':
    case 'authenticate_user':
      return 'browser'
    case 'download_file':
    case 'read_file':
    case 'write_file':
    case 'move_file':
    case 'delete_file':
      return 'filesystem'
    case 'send_communication':
    case 'read_communication':
      return 'email'
    case 'execute_command':
      return 'terminal'
    case 'read_clipboard':
    case 'write_clipboard':
      return 'clipboard'
    case 'call_api':
      return 'api'
    case 'transform_data':
    case 'verify_state':
    case 'none':
    default:
      return 'none'
  }
}

// TaskGenerator class

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

    return data.tasks.map((t, i) => {
      const capability = resolveCapability(
        t.requiredCapability as TaskCapability | undefined,
        t.requiredTool as TaskTool | undefined,
        t.category
      )
      const tool = (t.requiredTool as TaskTool | undefined) ?? capabilityToTool(capability)

      return {
        id: ids[i] ?? generateId(),
        title: t.title,
        description: t.description,
        category: t.category,
        requiredCapability: capability,
        requiredTool: tool,
        suggestedTool: t.suggestedTool,
        expectedOutput: t.expectedOutput,
        isOptional: t.isOptional ?? false,
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
      }
    })
  }
}
