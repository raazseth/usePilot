import type { ExecutionOutcome } from '@usepilot/evaluation-types'
import type { ComposedExecutionReceipt } from '@usepilot/skill-types'
import { describe, it, expect } from 'vitest'

import { ReliabilityEngine } from '../reliability/reliability-engine'
import { SkillEvaluator } from '../skill/skill-evaluator'
import { WorkflowEvaluator } from '../workflow/workflow-evaluator'

describe('SkillEvaluator & WorkflowEvaluator — Sample-Size Aware Reliability', () => {
  const createMockOutcome = (overrides?: Partial<ExecutionOutcome>): ExecutionOutcome => ({
    id: `out-${Math.random()}`,
    executionId: `exec-${Math.random()}`,
    goalId: 'goal-1',
    agentId: 'agent-1',
    agentVersion: '1.0.0',
    skillIds: ['download-documents'],
    skillVersions: { 'download-documents': '1.0.0' },
    status: 'SUCCESS',
    verificationStatus: true,
    durationMs: 400,
    retryCount: 0,
    replanCount: 0,
    artifacts: [],
    timestamp: Date.now(),
    ...overrides,
  })

  it('computes statistical confidence scaling with sample size (avoids fake 100% confidence on tiny samples)', () => {
    const evaluator = new SkillEvaluator()

    // 2 successes out of 2 runs
    evaluator.record(createMockOutcome())
    evaluator.record(createMockOutcome())

    const tinySampleRel = evaluator.getReliability('download-documents', '1.0.0')
    expect(tinySampleRel.sampleCount).toBe(2)
    expect(tinySampleRel.successRate).toBe(1)
    // Statistical confidence must be NONE for N=2
    expect(tinySampleRel.confidence).toBe('NONE')

    // Add 10 more successful executions (total 12)
    for (let i = 0; i < 10; i++) {
      evaluator.record(createMockOutcome())
    }
    const lowSampleRel = evaluator.getReliability('download-documents', '1.0.0')
    expect(lowSampleRel.sampleCount).toBe(12)
    expect(lowSampleRel.confidence).toBe('LOW')

    // Add 15 more (total 27)
    for (let i = 0; i < 15; i++) {
      evaluator.record(createMockOutcome())
    }
    const mediumSampleRel = evaluator.getReliability('download-documents', '1.0.0')
    expect(mediumSampleRel.sampleCount).toBe(27)
    expect(mediumSampleRel.confidence).toBe('MEDIUM')

    // Add 25 more (total 52)
    for (let i = 0; i < 25; i++) {
      evaluator.record(createMockOutcome())
    }
    const highSampleRel = evaluator.getReliability('download-documents', '1.0.0')
    expect(highSampleRel.sampleCount).toBe(52)
    expect(highSampleRel.confidence).toBe('HIGH')
  })

  it('accurately compares two versions of a Skill and identifies the superior version', () => {
    const evaluator = new SkillEvaluator()

    // Version 1.1: 10 runs, 7 successes, 3 failures
    for (let i = 0; i < 7; i++) {
      evaluator.record(createMockOutcome({ skillVersions: { 'download-documents': '1.1.0' } }))
    }
    for (let i = 0; i < 3; i++) {
      evaluator.record(
        createMockOutcome({
          skillVersions: { 'download-documents': '1.1.0' },
          status: 'FAILED',
          verificationStatus: false,
          failureCategory: 'TIMEOUT',
        })
      )
    }

    // Version 1.2: 15 runs, 14 successes, 1 failure
    for (let i = 0; i < 14; i++) {
      evaluator.record(createMockOutcome({ skillVersions: { 'download-documents': '1.2.0' } }))
    }
    evaluator.record(
      createMockOutcome({
        skillVersions: { 'download-documents': '1.2.0' },
        status: 'FAILED',
        verificationStatus: false,
        failureCategory: 'BROWSER',
      })
    )

    const comparison = evaluator.compareVersions('download-documents', '1.1.0', '1.2.0')
    expect(comparison.sampleCountA).toBe(10)
    expect(comparison.sampleCountB).toBe(15)
    expect(comparison.verificationRateA).toBe(0.7)
    expect(comparison.verificationRateB).toBe(0.933)
    expect(comparison.superiorVersion).toBe('1.2.0')
    expect(comparison.recommendation).toContain('Version 1.2.0 shows higher verified reliability')
  })

  it('pinpoints step-level bottlenecks in WorkflowEvaluator', () => {
    const wfEvaluator = new WorkflowEvaluator()

    const createReceipt = (step2Fails: boolean): ComposedExecutionReceipt => ({
      compositionId: 'research-download-organize',
      compositionVersion: '1.0.0',
      status: step2Fails ? 'failed' : 'completed',
      totalTasksExecuted: 3,
      durationMs: 900,
      stepReceipts: [
        { stepId: 'step-research', skillId: 'research-website', status: 'completed', verified: true, durationMs: 200, outputs: {} },
        {
          stepId: 'step-download',
          skillId: 'download-documents',
          status: step2Fails ? 'failed' : 'completed',
          verified: !step2Fails,
          durationMs: 400,
          error: step2Fails ? 'Network connection dropped' : undefined,
          outputs: {},
        },
        { stepId: 'step-organize', skillId: 'organize-downloads', status: step2Fails ? 'skipped' : 'completed', verified: !step2Fails, durationMs: 300, outputs: {} },
      ],
    })

    // Record 8 runs where download succeeds, 4 runs where download fails
    for (let i = 0; i < 8; i++) {
      wfEvaluator.record(
        createMockOutcome({ workflowId: 'research-download-organize', status: 'SUCCESS', verificationStatus: true }),
        createReceipt(false)
      )
    }
    for (let i = 0; i < 4; i++) {
      wfEvaluator.record(
        createMockOutcome({ workflowId: 'research-download-organize', status: 'FAILED', verificationStatus: false, failureCategory: 'NETWORK' }),
        createReceipt(true)
      )
    }

    const metrics = wfEvaluator.getMetrics('research-download-organize')
    expect(metrics.invocationCount).toBe(12)
    expect(metrics.successCount).toBe(8)
    expect(metrics.failureCount).toBe(4)
    expect(metrics.bottleneckStep).toBe('step-download')
    expect(metrics.steps['step-download']?.failureCount).toBe(4)
    expect(metrics.steps['step-download']?.failureReasonFrequency['Network connection dropped']).toBe(4)
  })

  it('detects recurring successful skill patterns as workflow candidates', () => {
    const wfEvaluator = new WorkflowEvaluator()

    // Record 4 identical multi-skill sequence runs
    for (let i = 0; i < 4; i++) {
      wfEvaluator.record(
        createMockOutcome({
          skillIds: ['find-files', 'bulk-rename-files'],
          status: 'SUCCESS',
          durationMs: 500,
        })
      )
    }

    const candidates = wfEvaluator.detectCandidateWorkflows(3, 0.8)
    expect(candidates.length).toBe(1)
    expect(candidates[0]?.proposedWorkflowId).toBe('find-files-and-bulk-rename-files')
    expect(candidates[0]?.occurrenceCount).toBe(4)
    expect(candidates[0]?.successRate).toBe(1)
  })

  it('ReliabilityEngine recommends preferred workflow based on verified statistical evidence', () => {
    const skillEvaluator = new SkillEvaluator()
    const workflowEvaluator = new WorkflowEvaluator()
    const engine = new ReliabilityEngine(skillEvaluator, workflowEvaluator)

    // Workflow A: 20 runs, 18 verified successes (90%)
    for (let i = 0; i < 18; i++) {
      workflowEvaluator.record(
        createMockOutcome({ workflowId: 'workflow-fast', status: 'SUCCESS', verificationStatus: true })
      )
    }
    for (let i = 0; i < 2; i++) {
      workflowEvaluator.record(
        createMockOutcome({ workflowId: 'workflow-fast', status: 'FAILED', verificationStatus: false })
      )
    }

    // Workflow B: 20 runs, 12 verified successes (60%)
    for (let i = 0; i < 12; i++) {
      workflowEvaluator.record(
        createMockOutcome({ workflowId: 'workflow-slow', status: 'SUCCESS', verificationStatus: true })
      )
    }
    for (let i = 0; i < 8; i++) {
      workflowEvaluator.record(
        createMockOutcome({ workflowId: 'workflow-slow', status: 'FAILED', verificationStatus: false })
      )
    }

    const comparison = engine.recommendPreferredWorkflow('workflow-slow', 'workflow-fast')
    expect(comparison.selectedWorkflow).toBe('workflow-fast')
    expect(comparison.reason).toContain('higher verified success rate')
  })
})
