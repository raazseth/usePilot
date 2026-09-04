import { describe, it, expect } from 'vitest'
import { SchemaValidator } from '../validation/schema-validator'
import { SemanticValidator } from '../validation/semantic-validator'
import { ExecutionValidator } from '../validation/execution-validator'
import type { ExecutionBlueprint, PlannerContext } from '@usepilot/planner-types'

function makeValidBlueprint(): ExecutionBlueprint {
  return {
    id: 'bp-1',
    version: 1,
    hash: 'fakehash123',
    goal: {
      id: 'g-1',
      primaryObjective: 'Download all invoices from portal',
      constraints: [],
      rawConstraints: [],
      requiredResources: [],
      expectedOutcome: 'Invoices downloaded to disk',
      confidence: 0.95,
      normalizedInput: {
        text: 'Download invoices',
        originalText: 'Download invoices',
        detectedLanguage: 'en',
        entities: [],
        durationMs: 1,
      },
      status: 'validated',
      createdAt: Date.now(),
    },
    intent: {
      type: 'browser',
      riskLevel: 'low',
      complexity: 'low',
      requiresHumanApproval: false,
      missingInformation: [],
      confidence: 0.9,
      durationMs: 10,
    },
    tasks: [
      {
        id: 't-1',
        title: 'Open portal page',
        description: 'Navigate to user account billing portal',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        requiredTool: 'browser',
        preconditions: ['Browser open'],
        postconditions: ['Portal visible'],
        successConditions: ['Portal URL reached'],
        failureConditions: ['Network timeout'],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 2, backoffMs: 1000, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 0.95,
      },
      {
        id: 't-2',
        title: 'Download invoice PDF',
        description: 'Click the download button for invoice',
        category: 'extraction',
        requiredCapability: 'download_file',
        requiredTool: 'browser',
        preconditions: ['Portal visible'],
        postconditions: ['File saved'],
        successConditions: ['PDF file exists on disk'],
        failureConditions: ['Download error'],
        dependsOn: ['t-1'],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 2, backoffMs: 1000, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 0.95,
      },
    ],
    graph: {
      nodes: [
        { taskId: 't-1', layer: 0, isCritical: true, canParallelize: false, inDegree: 0, outDegree: 1 },
        { taskId: 't-2', layer: 1, isCritical: true, canParallelize: false, inDegree: 1, outDegree: 0 },
      ],
      edges: [{ from: 't-1', to: 't-2', type: 'depends_on' }],
      parallelGroups: [],
      criticalPath: ['t-1', 't-2'],
      taskCount: 2,
      depth: 2,
    },
    approvals: {
      requiresMandatoryApproval: false,
      hasForbiddenTasks: false,
      mandatoryTaskIds: [],
      optionalTaskIds: [],
      forbiddenTaskIds: [],
    },
    successCriteria: [
      { condition: 'PDF file exists on disk', verificationStrategy: 'state_check', required: true },
    ],
    estimatedComplexity: 'low',
    optimization: {
      mergedTasks: [],
      removedDuplicates: [],
      newParallelGroups: [],
      simplifications: [],
      changed: false,
    },
    plannerContext: {
      platform: 'windows',
      availableTools: ['browser', 'filesystem'],
      settingsSnapshot: {},
      previousBlueprintCount: 0,
    },
    createdAt: Date.now(),
  }
}

const mockContext: PlannerContext = {
  conversationId: 'c-1',
  conversationHistory: [],
  settings: {
    activeProviderType: 'ollama',
    defaultModel: 'qwen2.5-coder:3b',
    temperature: 0.2,
    featureFlags: {},
  },
  availableTools: ['browser', 'filesystem', 'api', 'clipboard', 'none'],
  platform: 'windows',
  previousBlueprints: [],
}

describe('Three-Layer Validation Suite', () => {
  const schemaValidator = new SchemaValidator()
  const semanticValidator = new SemanticValidator()
  const executionValidator = new ExecutionValidator()

  it('passes a fully valid blueprint through all three layers', () => {
    const bp = makeValidBlueprint()

    const schemaRes = schemaValidator.validate(bp)
    expect(schemaRes.passed).toBe(true)

    const semanticRes = semanticValidator.validate(bp)
    expect(semanticRes.passed).toBe(true)

    const execRes = executionValidator.validate(bp, mockContext)
    expect(execRes.passed).toBe(true)
  })

  it('SchemaValidator catches structural defects', () => {
    const broken = makeValidBlueprint()
    // @ts-expect-error test schema violation
    broken.tasks[0].requiredTool = 'non-existent-tool'

    const res = schemaValidator.validate(broken)
    expect(res.passed).toBe(false)
  })

  it('SemanticValidator detects orphan nodes or duplicate task IDs', () => {
    const bp = makeValidBlueprint()
    // duplicate IDs
    bp.tasks[1]!.id = bp.tasks[0]!.id

    const res = semanticValidator.validate(bp)
    expect(res.passed).toBe(false)
    expect(res.issues.some((i) => i.code === 'DUPLICATE_TASK_ID')).toBe(true)
  })

  it('ExecutionValidator flags forbidden tasks and rejects plan', () => {
    const bp = makeValidBlueprint()
    bp.tasks[0]!.approvalPolicy = 'forbidden'
    bp.tasks[0]!.approvalReason = 'Testing forbidden rejection'

    const res = executionValidator.validate(bp, mockContext)
    expect(res.passed).toBe(false)
    expect(res.issues.some((i) => i.code === 'FORBIDDEN_TASK')).toBe(true)
  })

  it('ExecutionValidator flags missing unavailable tools as warnings', () => {
    const bp = makeValidBlueprint()
    const contextWithoutBrowser: PlannerContext = {
      ...mockContext,
      availableTools: ['terminal', 'api'], // browser is missing
    }

    const res = executionValidator.validate(bp, contextWithoutBrowser)
    expect(res.issues.some((i) => i.code === 'TOOL_UNAVAILABLE')).toBe(true)
    expect(res.issues.find((i) => i.code === 'TOOL_UNAVAILABLE')?.severity).toBe('warning')
  })
})
