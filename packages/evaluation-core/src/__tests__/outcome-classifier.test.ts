import type { ComposedExecutionReceipt, StepExecutionReceipt } from '@usepilot/skill-types'
import { describe, it, expect } from 'vitest'

import { OutcomeClassifier } from '../outcome/outcome-classifier'

describe('OutcomeClassifier — Canonical Status & Failure Taxonomy', () => {
  const classifier = new OutcomeClassifier()

  const createMockReceipt = (overrides?: Partial<ComposedExecutionReceipt>): ComposedExecutionReceipt => ({
    compositionId: 'test-workflow',
    compositionVersion: '1.0.0',
    status: 'completed',
    stepReceipts: [
      {
        stepId: 'step1',
        skillId: 'download-documents',
        status: 'completed',
        verified: true,
        durationMs: 500,
        outputs: { artifacts: ['report.pdf'], retryCount: 0 },
      },
      {
        stepId: 'step2',
        skillId: 'organize-downloads',
        status: 'completed',
        verified: true,
        durationMs: 300,
        outputs: { retryCount: 1 },
      },
    ],
    totalTasksExecuted: 2,
    durationMs: 800,
    ...overrides,
  })

  it('classifies fully verified execution as SUCCESS', () => {
    const outcome = classifier.classify({
      executionId: 'exec-1',
      goalId: 'goal-1',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt: createMockReceipt(),
    })

    expect(outcome.status).toBe('SUCCESS')
    expect(outcome.verificationStatus).toBe(true)
    expect(outcome.failureCategory).toBeUndefined()
    expect(outcome.artifacts).toContain('report.pdf')
    expect(outcome.retryCount).toBe(1)
  })

  it('classifies execution as VERIFICATION_FAILURE when a step is unverified despite runner completion', () => {
    const unverifiedStepReceipt: StepExecutionReceipt = {
      stepId: 'step2',
      skillId: 'organize-downloads',
      status: 'completed',
      verified: false, // Verification failed!
      durationMs: 300,
      outputs: {},
    }

    const receipt = createMockReceipt({
      stepReceipts: [createMockReceipt().stepReceipts[0]!, unverifiedStepReceipt],
    })

    const outcome = classifier.classify({
      executionId: 'exec-2',
      goalId: 'goal-2',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt,
    })

    expect(outcome.status).toBe('VERIFICATION_FAILURE')
    expect(outcome.verificationStatus).toBe(false)
    expect(outcome.failureCategory).toBe('VERIFICATION')
    expect(outcome.failureReason).toContain('verification failed for step(s): step2')
  })

  it('classifies partial completion as PARTIAL_SUCCESS', () => {
    const skippedStepReceipt: StepExecutionReceipt = {
      stepId: 'step2',
      skillId: 'organize-downloads',
      status: 'skipped',
      verified: false,
      durationMs: 0,
      outputs: {},
    }

    const receipt = createMockReceipt({
      stepReceipts: [createMockReceipt().stepReceipts[0]!, skippedStepReceipt],
    })

    const outcome = classifier.classify({
      executionId: 'exec-3',
      goalId: 'goal-3',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt,
    })

    expect(outcome.status).toBe('PARTIAL_SUCCESS')
    expect(outcome.verificationStatus).toBe(true)
  })

  it('classifies blocked approval as BLOCKED with PERMISSION category', () => {
    const receipt = createMockReceipt({
      status: 'approval_required',
      pendingApprovalStepId: 'step2-bulk-rename',
    })

    const outcome = classifier.classify({
      executionId: 'exec-4',
      goalId: 'goal-4',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt,
    })

    expect(outcome.status).toBe('BLOCKED')
    expect(outcome.verificationStatus).toBe(false)
    expect(outcome.failureCategory).toBe('PERMISSION')
    expect(outcome.failureReason).toContain('step2-bulk-rename')
  })

  it('classifies clarification boundary as CLARIFICATION_REQUIRED', () => {
    const outcome = classifier.classify({
      executionId: 'exec-5',
      goalId: 'goal-5',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      clarificationRequired: true,
    })

    expect(outcome.status).toBe('CLARIFICATION_REQUIRED')
    expect(outcome.verificationStatus).toBe(false)
    expect(outcome.failureCategory).toBe('GOAL_UNDERSTANDING')
  })

  it('classifies user correction signal as USER_CORRECTED', () => {
    const outcome = classifier.classify({
      executionId: 'exec-6',
      goalId: 'goal-6',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt: createMockReceipt(),
      userFeedback: {
        type: 'CORRECTION',
        correctedValue: 'Save to Reports folder instead of Documents',
        timestamp: Date.now(),
      },
    })

    expect(outcome.status).toBe('USER_CORRECTED')
    expect(outcome.userCorrection).toBe('Save to Reports folder instead of Documents')
  })

  it('classifies user rejection signal as USER_REJECTED', () => {
    const outcome = classifier.classify({
      executionId: 'exec-7',
      goalId: 'goal-7',
      agentId: 'agent-1',
      agentVersion: '1.0.0',
      receipt: createMockReceipt(),
      userFeedback: {
        type: 'REJECTION',
        rejectedReason: 'Output format did not match table requirement',
        timestamp: Date.now(),
      },
    })

    expect(outcome.status).toBe('USER_REJECTED')
    expect(outcome.verificationStatus).toBe(false)
    expect(outcome.userRejection).toBe('Output format did not match table requirement')
  })

  it('correctly maps diverse error strings to failure categories', () => {
    expect(classifier.categorizeFailure('net::ERR_CONNECTION_REFUSED')).toBe('NETWORK')
    expect(classifier.categorizeFailure('ENOENT: no such file or directory')).toBe('FILESYSTEM')
    expect(classifier.categorizeFailure('Action timed out after 30000ms')).toBe('TIMEOUT')
    expect(classifier.categorizeFailure('Target DOM element button#submit not visible')).toBe('BROWSER')
    expect(classifier.categorizeFailure('Access Denied: operation requires elevated permissions')).toBe('PERMISSION')
    expect(classifier.categorizeFailure('SHA-256 Checksum mismatch on downloaded file')).toBe('VERIFICATION')
    expect(classifier.categorizeFailure('Missing required argument: targetDirectory')).toBe('PARAMETER')
    expect(classifier.categorizeFailure('Session expired: 401 Unauthorized')).toBe('AUTHENTICATION')
    expect(classifier.categorizeFailure('Unrecognized instruction syntax')).toBe('RUNTIME')
  })
})
