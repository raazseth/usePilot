import type { Task } from '@usepilot/planner-types'
import { describe, it, expect } from 'vitest'

import { ExecutionPolicyEngine, createDefaultExecutionPolicy } from '../policy/engine'

function makeMockTask(overrides?: Partial<Task>): Task {
  return {
    id: 't-1',
    title: 'Test Task',
    description: 'Test policy task',
    category: 'computation',
    requiredCapability: 'execute_command',
    complexity: 'low',
    confidence: 1,
    dependsOn: [],
    preconditions: [],
    postconditions: [],
    successConditions: [],
    failureConditions: [],
    approvalPolicy: 'automatic',
    failureStrategy: { onFailure: 'abort' },
    retryPolicy: { maxAttempts: 3, backoffMs: 100, exponential: true },
    ...overrides,
  }
}

describe('ExecutionPolicyEngine', () => {
  it('creates default policy with conservative defaults', () => {
    const policy = createDefaultExecutionPolicy()
    expect(policy.maxParallelism).toBe(4)
    expect(policy.retry.maxAttempts).toBe(3)
    expect(policy.approval.enforcement).toBe('default')
    expect(policy.verification.defaultLevel).toBe('standard')
    expect(policy.timeout.defaultTaskTimeoutMs).toBe(60000)
    expect(policy.adapter.sessionScope).toBe('capability')
  })

  it('determines retry eligibility correctly based on failure categories', () => {
    const engine = new ExecutionPolicyEngine()
    const task = makeMockTask()

    expect(engine.shouldRetry(task, 1, 'adapter_failure')).toBe(true)
    expect(engine.shouldRetry(task, 1, 'timeout')).toBe(true)
    expect(engine.shouldRetry(task, 1, 'verification_failure')).toBe(true)

    // Non-retryable
    expect(engine.shouldRetry(task, 1, 'cancellation')).toBe(false)
    expect(engine.shouldRetry(task, 1, 'approval_denied')).toBe(false)
    expect(engine.shouldRetry(task, 1, 'configuration')).toBe(false)

    // Exhausted attempts
    expect(engine.shouldRetry(task, 3, 'adapter_failure')).toBe(false)
  })

  it('calculates exponential backoff capped by maxBackoffMs', () => {
    const engine = new ExecutionPolicyEngine({
      retry: {
        maxAttempts: 5,
        initialBackoffMs: 100,
        maxBackoffMs: 1000,
        backoffMultiplier: 2,
        retryableCategories: ['adapter_failure'],
      },
    })

    expect(engine.getRetryBackoffMs(1)).toBe(100)
    expect(engine.getRetryBackoffMs(2)).toBe(200)
    expect(engine.getRetryBackoffMs(3)).toBe(400)
    expect(engine.getRetryBackoffMs(4)).toBe(800)
    expect(engine.getRetryBackoffMs(5)).toBe(1000) // capped at maxBackoffMs
  })

  it('evaluates verification levels based on complexity', () => {
    const engine = new ExecutionPolicyEngine()
    const lowTask = makeMockTask({ complexity: 'low' })
    const highTask = makeMockTask({ complexity: 'high' })

    expect(engine.getVerificationLevel(lowTask)).toBe('standard')
    expect(engine.getVerificationLevel(highTask)).toBe('strict')
  })

  it('evaluates approval requirements under strict vs default enforcement', () => {
    const defaultEngine = new ExecutionPolicyEngine()
    const strictEngine = new ExecutionPolicyEngine({
      approval: { enforcement: 'strict', timeoutMs: 300000 },
    })

    const autoTask = makeMockTask({ approvalPolicy: 'automatic' })
    const optTask = makeMockTask({ approvalPolicy: 'optional' })
    const manTask = makeMockTask({ approvalPolicy: 'mandatory' })

    expect(defaultEngine.getApprovalRequirement(autoTask).required).toBe(false)
    expect(defaultEngine.getApprovalRequirement(optTask).required).toBe(false)
    expect(defaultEngine.getApprovalRequirement(manTask).required).toBe(true)

    // Strict mode enforces optional tasks as well
    expect(strictEngine.getApprovalRequirement(optTask).required).toBe(true)
    expect(strictEngine.getApprovalRequirement(autoTask).required).toBe(false)
  })
})
