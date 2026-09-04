// SchemaValidator — Layer 1

import { z } from 'zod'
import type { ExecutionBlueprint, LayerValidationResult, ValidationIssue } from '@usepilot/planner-types'

const TaskSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  requiredTool: z.enum(['browser', 'filesystem', 'email', 'terminal', 'clipboard', 'api', 'none']),
  approvalPolicy: z.enum(['automatic', 'optional', 'mandatory', 'forbidden']),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  successConditions: z.array(z.string()).min(1),
  dependsOn: z.array(z.string()),
  complexity: z.enum(['low', 'medium', 'high', 'unknown']),
})

const BlueprintSchemaCheck = z.object({
  id: z.string().min(1),
  goal: z.object({
    primaryObjective: z.string().min(1),
    expectedOutcome: z.string().min(1),
  }),
  tasks: z.array(TaskSchema).min(1),
  graph: z.object({
    nodes: z.array(z.object({ taskId: z.string() })).min(1),
    edges: z.array(z.object({ from: z.string(), to: z.string(), type: z.string() })),
  }),
})

export class SchemaValidator {
  validate(blueprint: Partial<ExecutionBlueprint>): LayerValidationResult {
    const start = Date.now()
    const issues: ValidationIssue[] = []

    const result = BlueprintSchemaCheck.safeParse(blueprint)
    if (!result.success) {
      for (const issue of result.error.issues) {
        issues.push({
          layer: 'schema',
          severity: 'error',
          code: 'SCHEMA_VIOLATION',
          message: issue.message,
          target: issue.path.join('.'),
        })
      }
    }

    return {
      layer: 'schema',
      passed: issues.length === 0,
      issues,
      durationMs: Date.now() - start,
    }
  }
}
