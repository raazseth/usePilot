import type { Task } from '@usepilot/planner-types'
import { describe, it, expect } from 'vitest'

import { ApprovalGate } from '../approval-gate'

function makeTask(id: string): Task {
  return {
    id, title: `Task ${id}`, description: '', category: 'computation',
    requiredCapability: 'transform_data', preconditions: [], postconditions: [],
    successConditions: [], failureConditions: [], dependsOn: [],
    approvalPolicy: 'mandatory', approvalReason: 'Test approval',
    complexity: 'low',
    retryPolicy: { maxAttempts: 1, backoffMs: 0, exponential: false },
    failureStrategy: { onFailure: 'abort' }, confidence: 0.9,
  }
}

describe('ApprovalGate', () => {
  it('resolves approval when approved', async () => {
    const gate = new ApprovalGate({ timeoutMs: 5000 })
    const task = makeTask('t1')

    setTimeout(() => {
      gate.resolve('t1', { requestId: 'r1', taskId: 't1', approved: true, respondedAt: Date.now() })
    }, 30)

    const response = await gate.requestApproval('run-1', 'trace-1', task)
    expect(response.approved).toBe(true)
    expect(gate.hasPending('t1')).toBe(false)
  })

  it('resolves approval when rejected', async () => {
    const gate = new ApprovalGate({ timeoutMs: 5000 })
    const task = makeTask('t2')

    setTimeout(() => {
      gate.resolve('t2', { requestId: 'r2', taskId: 't2', approved: false, respondedAt: Date.now() })
    }, 30)

    const response = await gate.requestApproval('run-1', 'trace-1', task)
    expect(response.approved).toBe(false)
  })

  it('times out and rejects after timeout period', async () => {
    const gate = new ApprovalGate({ timeoutMs: 50 })
    const task = makeTask('t3')

    await expect(gate.requestApproval('run-1', 'trace-1', task)).rejects.toThrow(/timeout/i)
    expect(gate.hasPending('t3')).toBe(false)
  })

  it('tracks pending approvals', () => {
    const gate = new ApprovalGate({ timeoutMs: 5000 })
    const task = makeTask('t4')

    // Start approval without awaiting
    void gate.requestApproval('run-1', 'trace-1', task).catch(() => {})
    expect(gate.hasPending('t4')).toBe(true)

    const pending = gate.getPendingRequest('t4')
    expect(pending?.taskId).toBe('t4')

    gate.clearAll()
  })

  it('clearAll removes all pending approvals', () => {
    const gate = new ApprovalGate({ timeoutMs: 5000 })
    void gate.requestApproval('run-1', 'trace-1', makeTask('t5')).catch(() => {})
    void gate.requestApproval('run-2', 'trace-2', makeTask('t6')).catch(() => {})

    gate.clearAll()

    expect(gate.getAllPending()).toHaveLength(0)
  })
})
