import './planner.css'
import { useState } from 'react'
import type { Task } from '@usepilot/planner-types'

interface TaskCardProps {
  task: Task
  index: number
}

const CAPABILITY_CONFIG: Record<string, { icon: string; label: string }> = {
  navigate_website: { icon: '🌐', label: 'navigate' },
  download_file: { icon: '⬇️', label: 'download' },
  read_file: { icon: '📄', label: 'read file' },
  write_file: { icon: '💾', label: 'write file' },
  move_file: { icon: '📁', label: 'move file' },
  delete_file: { icon: '🗑️', label: 'delete file' },
  search_web: { icon: '🔍', label: 'search web' },
  extract_web_data: { icon: '📊', label: 'extract' },
  authenticate_user: { icon: '🔐', label: 'auth' },
  send_communication: { icon: '✉️', label: 'send msg' },
  read_communication: { icon: '📬', label: 'read msg' },
  execute_command: { icon: '💻', label: 'exec cmd' },
  read_clipboard: { icon: '📋', label: 'read clip' },
  write_clipboard: { icon: '📋', label: 'write clip' },
  call_api: { icon: '⚡', label: 'call api' },
  transform_data: { icon: '⚙️', label: 'transform' },
  verify_state: { icon: '✓', label: 'verify' },
  none: { icon: '•', label: 'none' },
}

export function TaskCard({ task, index }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)
  const capKey = task.requiredCapability || (task.requiredTool as string) || 'none'
  const cap = CAPABILITY_CONFIG[capKey] ?? { icon: '🔧', label: capKey }

  return (
    <div className="task-card">
      <div
        className="task-card-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="task-card-num">{index + 1}</div>
        <div className="task-card-title">
          {task.title}
          {task.isOptional && <span className="task-optional-tag">Optional</span>}
        </div>
        <div className="task-card-badges">
          <span className="task-tool-badge" title={`Capability: ${capKey}`}>
            <span>{cap.icon}</span>
            <span>{cap.label}</span>
          </span>
          {task.suggestedTool && (
            <span className="task-suggested-tool-badge" title={`Suggested Adapter: ${task.suggestedTool}`}>
              {task.suggestedTool}
            </span>
          )}
          <span className={`plan-badge task-approval-badge-${task.approvalPolicy}`}>
            {task.approvalPolicy}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="task-card-body">
          <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
            {task.description}
          </p>

          {task.expectedOutput && (
            <div className="task-conditions-section">
              <span className="task-conditions-label">Expected Output</span>
              <div style={{ fontSize: '11px', color: '#818cf8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>📦</span>
                <span>{task.expectedOutput}</span>
              </div>
            </div>
          )}

          {task.preconditions && task.preconditions.length > 0 && (
            <div className="task-conditions-section">
              <span className="task-conditions-label">Preconditions</span>
              {task.preconditions.map((pre, idx) => (
                <div key={idx} className="task-condition-item">
                  <span className="task-condition-pre">✓</span>
                  <span>{pre}</span>
                </div>
              ))}
            </div>
          )}

          {task.postconditions && task.postconditions.length > 0 && (
            <div className="task-conditions-section">
              <span className="task-conditions-label">Postconditions</span>
              {task.postconditions.map((post, idx) => (
                <div key={idx} className="task-condition-item">
                  <span className="task-condition-post">★</span>
                  <span>{post}</span>
                </div>
              ))}
            </div>
          )}

          {task.dependsOn && task.dependsOn.length > 0 && (
            <div className="task-conditions-section">
              <span className="task-conditions-label">Depends On</span>
              <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                {task.dependsOn.join(', ')}
              </div>
            </div>
          )}

          {task.approvalReason && (
            <div style={{ fontSize: '11px', color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>
              Policy reason: {task.approvalReason}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
