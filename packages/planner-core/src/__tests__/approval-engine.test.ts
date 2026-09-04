import { describe, it, expect } from 'vitest'
import { ApprovalEngine } from '../approval/approval-engine'
import type { Task } from '@usepilot/planner-types'

function makeTask(title: string, description: string = ''): Task {
  return {
    id: 't-1',
    title,
    description: description || title,
    category: 'other',
    requiredCapability: 'none',
    requiredTool: 'browser',
    preconditions: [],
    postconditions: [],
    successConditions: [],
    failureConditions: [],
    dependsOn: [],
    approvalPolicy: 'automatic',
    complexity: 'low',
    retryPolicy: { maxAttempts: 2, backoffMs: 1000, exponential: false },
    failureStrategy: { onFailure: 'abort' },
    confidence: 0.9,
  }
}

describe('ApprovalEngine', () => {
  const engine = new ApprovalEngine()

  it('marks catastrophic actions as forbidden', () => {
    const task = makeTask('Delete System32 files to free up disk space')
    const policy = engine.evaluate(task)
    expect(policy.policy).toBe('forbidden')
  })

  it('marks financial transactions as mandatory', () => {
    const task = makeTask('Complete purchase on checkout page')
    const policy = engine.evaluate(task)
    expect(policy.policy).toBe('mandatory')
  })

  it('marks destructive file deletion as mandatory', () => {
    const task = makeTask('Delete old backup files from disk')
    const policy = engine.evaluate(task)
    expect(policy.policy).toBe('mandatory')
  })

  it('marks harmless navigation and extraction as automatic', () => {
    const task = makeTask('Navigate to google.com and search for news')
    const policy = engine.evaluate(task)
    expect(policy.policy).toBe('automatic')
  })
})
