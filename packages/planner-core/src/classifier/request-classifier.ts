// ─────────────────────────────────────────────────────────────────────────────
// RequestClassifier
// First stage of the pipeline. Routes natural-language input to the correct
// subsystem: conversation, planner, or future execution engine.
// Uses heuristic rules first; LLM fallback for ambiguous inputs.
// ─────────────────────────────────────────────────────────────────────────────

import type { ClassificationResult, RequestType } from '@usepilot/planner-types'
import type { AIProvider, ChatRequest } from '@usepilot/ai-core'
import { PlannerError, PlannerErrorCode } from '../errors'

// Keywords strongly associated with planning/execution intent
const PLANNING_SIGNALS = [
  'download', 'organize', 'automate', 'schedule', 'send email', 'create',
  'move files', 'rename', 'scrape', 'fill out', 'book', 'purchase', 'order',
  'submit', 'open', 'navigate', 'login', 'click', 'type', 'search for',
  'extract', 'compile', 'build', 'deploy', 'run', 'execute', 'set up',
]

const EXECUTION_SIGNALS = [
  'execute plan', 'run plan', 'start plan', 'execute blueprint',
  'run blueprint', 'start the plan', 'go ahead', 'proceed with plan',
  'cancel execution', 'stop execution', 'pause execution',
]

const CONVERSATION_SIGNALS = [
  'what is', 'explain', 'summarize', 'tell me', 'describe', 'how does',
  'what do you think', 'help me understand', 'can you', 'do you know',
  'define', 'difference between', 'compare',
]

const PLANNING_CLASSIFICATION_PROMPT = `You are a request classifier for an AI assistant.
Classify the following user input into exactly one of these categories:
- "conversation": The user wants information, explanation, or a conversational response.
- "planning": The user wants to automate a task or sequence of actions on their computer.
- "execution": The user wants to start, stop, or manage an existing execution plan.
- "unknown": Cannot be determined.

Respond with ONLY a JSON object with this exact shape:
{"type": "conversation"|"planning"|"execution"|"unknown", "confidence": 0.0-1.0, "reason": "brief explanation", "signals": ["signal1", "signal2"]}

User input: `

export class RequestClassifier {
  private readonly maxRetries = 2
  private readonly heuristicConfidenceThreshold = 0.75

  constructor(private readonly provider: AIProvider | null) {}

  async classify(text: string, model: string): Promise<ClassificationResult> {
    const start = Date.now()
    const normalized = text.trim().toLowerCase()

    // Fast heuristic pass — avoid LLM call for obvious inputs
    const heuristic = this.heuristicClassify(normalized)
    if (heuristic.confidence >= this.heuristicConfidenceThreshold) {
      return { ...heuristic, durationMs: Date.now() - start }
    }

    // LLM fallback for ambiguous inputs
    if (!this.provider) {
      // No provider — fall back to heuristic result regardless of confidence
      return { ...heuristic, durationMs: Date.now() - start }
    }

    return this.llmClassify(text, model, start)
  }

  private heuristicClassify(
    normalized: string
  ): Omit<ClassificationResult, 'durationMs'> {
    const executionMatches = EXECUTION_SIGNALS.filter((s) => normalized.includes(s))
    if (executionMatches.length > 0) {
      return {
        type: 'execution',
        confidence: Math.min(0.6 + executionMatches.length * 0.1, 0.95),
        reason: 'Execution control signals detected',
        signals: executionMatches,
      }
    }

    const planningMatches = PLANNING_SIGNALS.filter((s) => normalized.includes(s))
    const conversationMatches = CONVERSATION_SIGNALS.filter((s) => normalized.includes(s))

    if (planningMatches.length > 0 && planningMatches.length >= conversationMatches.length) {
      return {
        type: 'planning',
        confidence: Math.min(0.5 + planningMatches.length * 0.1, 0.92),
        reason: 'Action-oriented signals detected',
        signals: planningMatches,
      }
    }

    if (conversationMatches.length > 0) {
      return {
        type: 'conversation',
        confidence: Math.min(0.5 + conversationMatches.length * 0.1, 0.9),
        reason: 'Conversational signals detected',
        signals: conversationMatches,
      }
    }

    // Short inputs (<= 5 words) tend to be conversational
    const wordCount = normalized.split(/\s+/).length
    if (wordCount <= 5) {
      return {
        type: 'conversation',
        confidence: 0.55,
        reason: 'Short input — defaulting to conversation',
        signals: [],
      }
    }

    return {
      type: 'unknown',
      confidence: 0.3,
      reason: 'No clear signals detected',
      signals: [],
    }
  }

  private async llmClassify(
    text: string,
    model: string,
    startTime: number
  ): Promise<ClassificationResult> {
    const prompt = PLANNING_CLASSIFICATION_PROMPT + `"${text}"`
    let lastError: unknown

    for (let attempt = 0; attempt < this.maxRetries; attempt++) {
      try {
        const request: ChatRequest = {
          messages: [{ role: 'user', content: prompt }],
          model,
          temperature: 0,
          maxTokens: 150,
        }
        const response = await this.provider!.chat(request)
        const parsed = this.parseClassificationResponse(response.content)
        if (parsed) {
          return { ...parsed, durationMs: Date.now() - startTime }
        }
      } catch (err) {
        lastError = err
      }
    }

    // LLM failed — fall back to heuristic
    const heuristic = this.heuristicClassify(text.toLowerCase())
    console.warn('[RequestClassifier] LLM classification failed, using heuristic fallback:', lastError)
    return { ...heuristic, durationMs: Date.now() - startTime }
  }

  private parseClassificationResponse(
    content: string
  ): Omit<ClassificationResult, 'durationMs'> | null {
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch?.[0]) return null
      const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>
      const validTypes: RequestType[] = ['conversation', 'planning', 'execution', 'unknown']
      if (
        typeof parsed['type'] === 'string' &&
        validTypes.includes(parsed['type'] as RequestType) &&
        typeof parsed['confidence'] === 'number' &&
        typeof parsed['reason'] === 'string' &&
        Array.isArray(parsed['signals'])
      ) {
        return {
          type: parsed['type'] as RequestType,
          confidence: Math.max(0, Math.min(1, parsed['confidence'] as number)),
          reason: parsed['reason'] as string,
          signals: (parsed['signals'] as unknown[]).filter((s): s is string => typeof s === 'string'),
        }
      }
      return null
    } catch {
      return null
    }
  }
}

// Suppress unused import warning — PlannerError is used transitively
void PlannerError
void PlannerErrorCode
