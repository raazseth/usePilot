import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ExecutionPanel } from '../components/execution/ExecutionPanel'
import { useAppStore } from '../shared/store/appStore'
import { wsManager } from '../shared/api/websocket'

describe('ExecutionPanel Component', () => {
  beforeEach(() => {
    useAppStore.setState({
      executionStatus: null,
      executionRunId: null,
      executionTraceId: null,
      taskStatuses: {},
      taskProgress: { completed: 0, total: 0, currentTaskTitle: null },
      pendingApproval: null,
      permissionPrompt: null,
      browserActivity: null,
      activeCapability: null,
      activeAdapterInfo: null,
      verificationStatus: null,
      recoveryAttempts: [],
      lastExecutionReport: null,
    })
  })

  it('renders nothing when there is no active execution', () => {
    const { container } = render(<ExecutionPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders active execution panel with task progress and capability banner', () => {
    useAppStore.setState({
      executionStatus: 'running',
      executionRunId: 'run-101',
      executionTraceId: 'trace-202-abcdef123456',
      taskStatuses: { 'task-1': 'running', 'task-2': 'pending' },
      taskProgress: { completed: 0, total: 2, currentTaskTitle: 'Navigate to site' },
      activeCapability: 'navigate_website',
      activeAdapterInfo: 'PlaywrightBrowserAdapter',
    })

    render(<ExecutionPanel />)

    expect(screen.getByText(/Production Execution Engine/i)).toBeDefined()
    expect(screen.getByText('Running')).toBeDefined()
    expect(screen.getByText('navigate_website')).toBeDefined()
    expect(screen.getByText(/PlaywrightBrowserAdapter/i)).toBeDefined()
  })

  it('triggers cancel when cancel button is clicked', () => {
    const sendSpy = vi.spyOn(wsManager, 'send').mockImplementation(() => {})

    useAppStore.setState({
      executionStatus: 'running',
      executionRunId: 'run-cancel-test',
      executionTraceId: 'trace-cancel',
      taskStatuses: { 'task-1': 'running' },
      taskProgress: { completed: 0, total: 1, currentTaskTitle: 'Task 1' },
    })

    render(<ExecutionPanel />)

    const cancelBtn = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelBtn)

    expect(sendSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'execution.cancel',
        payload: { runId: 'run-cancel-test' },
      })
    )

    sendSpy.mockRestore()
  })

  it('renders execution report when execution completes', () => {
    useAppStore.setState({
      executionStatus: 'completed',
      executionRunId: 'run-done',
      executionTraceId: 'trace-done',
      taskStatuses: { 'task-1': 'completed' },
      taskProgress: { completed: 1, total: 1, currentTaskTitle: 'Task 1' },
      lastExecutionReport: {
        runId: 'run-done',
        traceId: 'trace-done',
        summary: 'Execution completed: 1/1 tasks succeeded',
        taskSummaries: [
          {
            taskId: 'task-1',
            taskTitle: 'Write configuration file',
            capability: 'write_file',
            status: 'completed',
            attemptCount: 1,
            durationMs: 42,
          },
        ],
        failureCategories: [],
        metrics: {
          runId: 'run-test-1',
          traceId: 'trace-test-1',
          totalDurationMs: 42,
          taskDurations: { 'task-1': 42 },
          adapterSelections: { 'task-1': 'NativeFilesystemAdapter' },
          verificationLatencies: { 'task-1': 5 },
          retryCount: 0,
          approvalWaitTimeMs: 0,
          checkpointCount: 1,
          journalEntryCount: 2,
          cancellationCount: 0,
          recoveryCount: 0,
        },
        createdAt: Date.now(),
      },
    })

    render(<ExecutionPanel />)

    expect(screen.getAllByText('Completed').length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText(/Execution completed: 1\/1 tasks succeeded/i)).toBeDefined()
  })
})
