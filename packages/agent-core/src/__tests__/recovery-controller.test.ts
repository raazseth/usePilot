import type { SkillComposition } from '@usepilot/skill-types'
import { describe, it, expect } from 'vitest'

import { AgentRecoveryController } from '../recovery/recovery-controller'

describe('AgentRecoveryController', () => {
  const sampleComp: SkillComposition = {
    id: 'test-comp',
    name: 'Test Workflow',
    description: 'Test',
    version: '1.0.0',
    steps: [
      { stepId: 'step-1', skillId: 'research-website', inputBindings: {} },
      { stepId: 'step-2', skillId: 'download-documents', inputBindings: {} },
    ],
  }

  it('formulates a revised composition on recoverable step failure', () => {
    const controller = new AgentRecoveryController({ maxReplans: 2, maxIterations: 5 })

    const recovery = controller.evaluateFailure('Download link not reachable', 'step-1', sampleComp)
    expect(recovery.action).toBe('REPLAN')
    expect(recovery.canRecover).toBe(true)
    expect(recovery.replanCount).toBe(1)
    expect(recovery.revisedComposition).toBeDefined()
    expect(recovery.revisedComposition?.steps.length).toBe(1)
    expect(recovery.revisedComposition?.steps[0]?.stepId).toBe('step-2')
  })

  it('aborts immediately on security and permission violations', () => {
    const controller = new AgentRecoveryController()
    const recovery = controller.evaluateFailure('Permission denied: filesystem write forbidden')
    expect(recovery.action).toBe('ABORT')
    expect(recovery.canRecover).toBe(false)
  })

  it('strictly enforces maxReplans limit to prevent unbounded loops', () => {
    const controller = new AgentRecoveryController({ maxReplans: 1, maxIterations: 10 })

    // First replan
    const r1 = controller.evaluateFailure('Failure 1', 'step-1', sampleComp)
    expect(r1.action).toBe('REPLAN')

    // Second replan exceeds maxReplans=1
    const r2 = controller.evaluateFailure('Failure 2', 'step-2', sampleComp)
    expect(r2.action).toBe('ABORT')
    expect(r2.canRecover).toBe(false)
    expect(r2.reason).toContain('Exceeded maximum replan limit')
  })

  it('strictly enforces maxIterations limit', () => {
    const controller = new AgentRecoveryController({ maxReplans: 5, maxIterations: 2 })

    controller.recordIteration()
    const r = controller.evaluateFailure('Transient error')
    expect(r.action).toBe('ABORT')
    expect(r.canRecover).toBe(false)
    expect(r.reason).toContain('Exceeded maximum agent iteration limit')
  })
})
