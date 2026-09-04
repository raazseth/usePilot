import { describe, it, expect } from 'vitest'
import { PlanSerializer } from '../serializer'
import type { ExecutionBlueprint } from '@usepilot/planner-types'

function makeMockBlueprint(): ExecutionBlueprint {
  return {
    id: 'orig-id',
    version: 1,
    hash: '',
    goal: {
      id: 'g-1',
      conversationId: 'c-1',
      rawText: 'Test goal',
      normalizedText: 'Test goal',
      primaryObjective: 'Test primary objective',
      constraints: ['Constraint B', 'Constraint A'],
      requiredResources: [],
      expectedOutcome: 'Expected outcome',
      confidence: 0.9,
      status: 'validated',
      createdAt: 1000,
    },
    intent: {
      type: 'Browser',
      riskLevel: 'low',
      complexity: 'low',
      reasoning: 'Browser task',
      suggestedTools: ['browser'],
      externalServices: [],
      confidence: 0.9,
    },
    tasks: [
      {
        id: 't-1',
        title: 'Task A',
        description: 'Desc A',
        category: 'navigation',
        requiredTool: 'browser',
        preconditions: [],
        postconditions: [],
        successConditions: ['Done'],
        failureConditions: [],
        dependsOn: [],
        approvalPolicy: 'automatic',
        complexity: 'low',
        retryPolicy: { maxAttempts: 1, backoffMs: 1000, exponential: false },
        failureStrategy: { onFailure: 'abort' },
        confidence: 0.9,
      },
    ],
    graph: {
      nodes: [{ taskId: 't-1', metadata: { layer: 0, isCritical: true, canParallelize: false } }],
      edges: [],
      parallelGroups: [],
      criticalPath: ['t-1'],
    },
    approvals: {
      requiresMandatoryApproval: false,
      hasForbiddenTasks: false,
      mandatoryTaskIds: [],
      optionalTaskIds: [],
      forbiddenTaskIds: [],
    },
    successCriteria: [{ condition: 'Done', verificationStrategy: 'state_check', required: true }],
    estimatedComplexity: 'low',
    optimization: { mergedTasks: [], removedDuplicates: [], newParallelGroups: [], simplifications: [], changed: false },
    plannerContext: { platform: 'windows', availableTools: [], settingsSnapshot: {}, previousBlueprintCount: 0 },
    createdAt: 1000,
  }
}

describe('PlanSerializer', () => {
  const serializer = new PlanSerializer()

  it('computes a stable SHA-256 hash regardless of volatile fields', async () => {
    const bp1 = makeMockBlueprint()
    const bp2 = makeMockBlueprint()

    // Modify volatile fields (id, version, createdAt)
    bp2.id = 'different-id'
    bp2.version = 5
    bp2.createdAt = 999999

    const hash1 = await serializer.computeHash(bp1)
    const hash2 = await serializer.computeHash(bp2)

    expect(hash1).toBe(hash2)
    expect(hash1.length).toBeGreaterThan(0)
  })

  it('serializes blueprint with assigned version and hash', async () => {
    const bp = makeMockBlueprint()
    const serialized = await serializer.serialize(bp, 2)

    expect(serialized.version).toBe(2)
    expect(serialized.hash).toBeTruthy()
    expect(serialized.id).toBeTruthy()
  })
})
