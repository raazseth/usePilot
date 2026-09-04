import './planner.css'
import { useState } from 'react'
import type { Task } from '@usepilot/planner-types'

interface TaskCardProps {
  task: Task
  index: number
}

const TOOL_ICONS: Record<string, string> = {
  browser: '🌐',
  filesystem: '📁',
  email: '✉️',
  terminal: '💻',
  clipboard: '📋',
  api: '⚡',
  none: '⚙️',
}

export function TaskCard({ task, index }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false)

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
        <div className="task-card-title">{task.title}</div>
        <div className="task-card-badges">
          <span className="task-tool-badge">
            <span>{TOOL_ICONS[task.requiredTool] ?? '🔧'}</span>
            <span>{task.requiredTool}</span>
          </span>
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
