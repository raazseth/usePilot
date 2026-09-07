import './execution.css'
import { useAppStore } from '../../shared/store/appStore'
import { wsManager } from '../../shared/api/websocket'
import { TaskStatusRow } from './TaskStatusRow'
import { ApprovalPrompt } from './ApprovalPrompt'
import { ExecutionReport } from './ExecutionReport'
import type { ExecutionReport as ExecutionReportType } from '@usepilot/execution-types'

interface ExecutionPanelProps {
  report?: ExecutionReportType
}

export function ExecutionPanel({ report }: ExecutionPanelProps) {
  const executionStatus = useAppStore((s) => s.executionStatus)
  const executionRunId = useAppStore((s) => s.executionRunId)
  const executionTraceId = useAppStore((s) => s.executionTraceId)
  const taskStatuses = useAppStore((s) => s.taskStatuses)
  const taskProgress = useAppStore((s) => s.taskProgress)
  const pendingApproval = useAppStore((s) => s.pendingApproval)

  if (!executionStatus || !executionRunId) return null

  const progressPct =
    taskProgress.total > 0
      ? Math.round((taskProgress.completed / taskProgress.total) * 100)
      : 0

  const isActive = executionStatus === 'running' || executionStatus === 'paused' || executionStatus === 'waiting_approval'
  const isDone = executionStatus === 'completed' || executionStatus === 'failed' || executionStatus === 'cancelled'

  const handlePause = () => wsManager.send({ type: 'execution.pause', payload: { runId: executionRunId } } as Parameters<typeof wsManager.send>[0])
  const handleResume = () => wsManager.send({ type: 'execution.resume', payload: { runId: executionRunId } } as Parameters<typeof wsManager.send>[0])
  const handleCancel = () => wsManager.send({ type: 'execution.cancel', payload: { runId: executionRunId } } as Parameters<typeof wsManager.send>[0])

  const taskEntries = Object.entries(taskStatuses)

  const statusLabel: Record<string, string> = {
    running:          'Running',
    paused:           'Paused',
    waiting_approval: 'Awaiting Approval',
    completed:        'Completed',
    failed:           'Failed',
    cancelled:        'Cancelled',
    created:          'Starting…',
    recovering:       'Recovering…',
  }

  return (
    <div className="execution-panel" id="execution-panel">
      {/* Header */}
      <div className="execution-header">
        <span className="execution-header-icon">
          {executionStatus === 'completed' ? '✅'
            : executionStatus === 'failed' ? '❌'
            : executionStatus === 'cancelled' ? '⛔'
            : '⚙️'}
        </span>
        <div className="execution-header-info">
          <div className="execution-title">Execution Engine</div>
          {executionTraceId && (
            <div className="execution-trace">{executionTraceId.slice(0, 16)}…</div>
          )}
        </div>
        <span className={`execution-status-badge execution-status-${executionStatus}`}>
          {statusLabel[executionStatus] ?? executionStatus}
        </span>
      </div>

      {/* Progress bar */}
      {(isActive || isDone) && taskProgress.total > 0 && (
        <div className="execution-progress-bar-wrap">
          <div
            className="execution-progress-bar-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      )}

      {/* Approval gate — inline, not a modal */}
      {pendingApproval && executionRunId && (
        <ApprovalPrompt request={pendingApproval} runId={executionRunId} />
      )}

      {/* Task timeline */}
      {taskEntries.length > 0 && (
        <div className="execution-task-list">
          {taskEntries.map(([taskId, status]) => (
            <TaskStatusRow
              key={taskId}
              taskId={taskId}
              taskTitle={taskId}
              capability="transform_data"
              status={status}
            />
          ))}
        </div>
      )}

      {/* Execution actions */}
      {isActive && (
        <div className="execution-actions">
          {executionStatus === 'running' && (
            <button id="exec-pause-btn" className="exec-btn exec-btn-pause" onClick={handlePause}>
              ⏸ Pause
            </button>
          )}
          {executionStatus === 'paused' && (
            <button id="exec-resume-btn" className="exec-btn exec-btn-resume" onClick={handleResume}>
              ▶ Resume
            </button>
          )}
          <button id="exec-cancel-btn" className="exec-btn exec-btn-cancel" onClick={handleCancel}>
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Final report */}
      {isDone && report && <ExecutionReport report={report} />}
    </div>
  )
}
