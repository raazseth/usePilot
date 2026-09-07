import './execution.css'
import { useState } from 'react'
import type { TaskExecutionStatus, FailureCategory } from '@usepilot/execution-types'

interface TaskStatusRowProps {
  taskId: string
  taskTitle: string
  capability: string
  status: TaskExecutionStatus
  attemptCount?: number
  durationMs?: number
  failureCategory?: FailureCategory
  errorMessage?: string
}

const STATUS_ICONS: Record<TaskExecutionStatus, string> = {
  pending:          '○',
  ready:            '◉',
  running:          '__spinner__',
  waiting_approval: '⏸',
  verifying:        '🔍',
  completed:        '✓',
  failed:           '✗',
  skipped:          '⊘',
  cancelled:        '✕',
  retrying:         '↻',
}

const CAPABILITY_LABELS: Record<string, string> = {
  navigate_website:   'Navigate',
  download_file:      'Download',
  read_file:          'Read File',
  write_file:         'Write File',
  move_file:          'Move File',
  delete_file:        'Delete File',
  search_web:         'Search Web',
  extract_web_data:   'Extract',
  authenticate_user:  'Auth',
  send_communication: 'Send Msg',
  read_communication: 'Read Msg',
  execute_command:    'Execute',
  read_clipboard:     'Clipboard',
  write_clipboard:    'Clipboard',
  call_api:           'API Call',
  transform_data:     'Transform',
  verify_state:       'Verify',
  none:               'None',
}

export function TaskStatusRow({
  taskId,
  taskTitle,
  capability,
  status,
  attemptCount = 0,
  durationMs,
  failureCategory,
  errorMessage,
}: TaskStatusRowProps) {
  const [expanded, setExpanded] = useState(false)

  const icon = STATUS_ICONS[status]
  const capLabel = CAPABILITY_LABELS[capability] ?? capability

  return (
    <>
      <div
        className="task-status-row"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        id={`task-row-${taskId}`}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="task-status-icon">
          {icon === '__spinner__' ? (
            <span className="task-status-spinner" />
          ) : (
            <span style={{
              color: status === 'completed' ? '#4ade80'
                : status === 'failed' ? '#f87171'
                : status === 'skipped' || status === 'cancelled' ? '#64748b'
                : '#60a5fa',
            }}>
              {icon}
            </span>
          )}
        </div>

        <span className={`task-status-title status-${status}`}>{taskTitle}</span>

        <span className="task-capability-badge">{capLabel}</span>

        {attemptCount > 1 && (
          <span className="task-retry-badge">×{attemptCount}</span>
        )}

        {durationMs !== undefined && status === 'completed' && (
          <span className="task-duration">{durationMs < 1000 ? `${durationMs}ms` : `${(durationMs / 1000).toFixed(1)}s`}</span>
        )}
      </div>

      {expanded && (status === 'failed' || status === 'skipped') && (
        <div className="task-detail-panel">
          {failureCategory && <div><strong>Category:</strong> {failureCategory}</div>}
          {errorMessage && <div><strong>Error:</strong> {errorMessage}</div>}
        </div>
      )}
    </>
  )
}
