import { describe, it, expect } from 'vitest'
import { PlanExplainer } from '../explainer/plan-explainer'
import type { Goal, Intent, Task, TaskGraph, ApprovalSummary, PlannerContext } from '@usepilot/planner-types'

describe('PlanExplainer', () => {
  const explainer = new PlanExplainer()

  const goal: Goal = {
    id: 'g-explain',
    primaryObjective: 'Download invoices and email them to accounting',
    expectedOutcome: 'Invoices emailed',
    constraints: [{ id: 'c-1', key: 'format', value: 'PDF', type: 'format', isHardConstraint: true }],
    rawConstraints: ['format: PDF'],
    requiredResources: [],
    confidence: 0.9,
    normalizedInput: {
      text: 'Download invoices and email them to accounting',
      originalText: 'Download invoices and email them to accounting',
      detectedLanguage: 'en',
      entities: [],
      durationMs: 1,
    },
    status: 'validated',
    createdAt: Date.now(),
  }

  const intent: Intent = {
    type: 'mixed',
    riskLevel: 'medium',
    complexity: 'medium',
    requiresHumanApproval: true,
    missingInformation: [],
    confidence: 0.85,
    durationMs: 10,
  }

  const tasks: Task[] = [
    {
      id: 'task-1',
      title: 'Navigate to portal and download invoice',
      description: 'Navigates and downloads invoice file',
      category: 'extraction',
      requiredCapability: 'download_file',
      requiredTool: 'filesystem',
      preconditions: [],
      postconditions: ['invoice.pdf exists'],
      successConditions: ['File downloaded'],
      failureConditions: [],
      dependsOn: [],
      approvalPolicy: 'automatic',
      complexity: 'low',
      retryPolicy: { maxAttempts: 3, backoffMs: 1000, exponential: true },
      failureStrategy: { onFailure: 'abort' },
      confidence: 0.9,
    },
    {
      id: 'task-2',
      title: 'Send email to accounting with invoice attached',
      description: 'Sends email',
      category: 'communication',
      requiredCapability: 'send_communication',
      requiredTool: 'email',
      preconditions: ['invoice.pdf exists'],
      postconditions: ['Email sent'],
      successConditions: ['Email sent successfully'],
      failureConditions: [],
      dependsOn: ['task-1'],
      approvalPolicy: 'mandatory',
      approvalReason: 'External communication requires review',
      complexity: 'medium',
      retryPolicy: { maxAttempts: 3, backoffMs: 1000, exponential: true },
      failureStrategy: { onFailure: 'abort' },
      confidence: 0.9,
    },
  ]

  const graph: TaskGraph = {
    nodes: [
      { taskId: 'task-1', layer: 0, isCritical: true, canParallelize: false, inDegree: 0, outDegree: 1 },
      { taskId: 'task-2', layer: 1, isCritical: true, canParallelize: false, inDegree: 1, outDegree: 0 },
    ],
    edges: [{ from: 'task-1', to: 'task-2', type: 'depends_on' }],
    parallelGroups: [],
    criticalPath: ['task-1', 'task-2'],
    taskCount: 2,
    depth: 2,
  }

  const approvals: ApprovalSummary = {
    requiresMandatoryApproval: true,
    hasForbiddenTasks: false,
    mandatoryTaskIds: ['task-2'],
    optionalTaskIds: [],
    forbiddenTaskIds: [],
  }

  const context: PlannerContext = {
    conversationId: 'c-1',
    conversationHistory: [],
    platform: 'windows',
    availableTools: ['browser', 'filesystem', 'email', 'terminal', 'clipboard', 'api'],
    availableCapabilities: ['download_file', 'send_communication'],
    settings: {
      defaultModel: 'test',
      activeProviderType: 'ollama',
      temperature: 0.7,
      featureFlags: {},
    },
    previousBlueprints: [],
  }

  it('generates comprehensive explanation including reasoning, assumptions, tradeoffs, and risk', () => {
    const explanation = explainer.explain(goal, intent, tasks, graph, approvals, context)
    expect(explanation.summary).toContain('2 atomic step(s)')
    expect(explanation.reasoning.length).toBeGreaterThan(0)
    expect(explanation.assumptions.some((a) => a.includes('windows'))).toBe(true)
    expect(explanation.tradeoffs.some((t) => t.includes('approval'))).toBe(true)
    expect(explanation.riskAssessment).toContain('1 task(s) require explicit user approval')
  })
})
