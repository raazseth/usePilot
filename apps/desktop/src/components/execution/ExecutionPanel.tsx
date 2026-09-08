import './execution.css'
import type { ExecutionReport as ExecutionReportType } from '@usepilot/execution-types'
import { useState } from 'react'

import { ApprovalPrompt } from './ApprovalPrompt'
import { ExecutionReport } from './ExecutionReport'
import { PermissionPrompt } from './PermissionPrompt'
import { TaskStatusRow } from './TaskStatusRow'
import { wsManager } from '../../shared/api/websocket'
import { useAppStore } from '../../shared/store/appStore'

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
  const permissionPrompt = useAppStore((s) => s.permissionPrompt)
  const setPermissionPrompt = useAppStore((s) => s.setPermissionPrompt)
  const browserActivity = useAppStore((s) => s.browserActivity)
  const activeCapability = useAppStore((s) => s.activeCapability)
  const activeAdapterInfo = useAppStore((s) => s.activeAdapterInfo)
  const verificationStatus = useAppStore((s) => s.verificationStatus)
  const recoveryAttempts = useAppStore((s) => s.recoveryAttempts)

  const [isScreenshotExpanded, setIsScreenshotExpanded] = useState(false)
  const [isRecoveryExpanded, setIsRecoveryExpanded] = useState(false)

  if (!executionStatus || !executionRunId) return null

  const progressPct =
    taskProgress.total > 0
      ? Math.round((taskProgress.completed / taskProgress.total) * 100)
      : 0

  const isActive =
    executionStatus === 'running' ||
    executionStatus === 'paused' ||
    executionStatus === 'waiting_approval'
  const isDone =
    executionStatus === 'completed' ||
    executionStatus === 'failed' ||
    executionStatus === 'cancelled'

  const handlePause = () =>
    wsManager.send({
      type: 'execution.pause',
      payload: { runId: executionRunId },
    } as Parameters<typeof wsManager.send>[0])
  const handleResume = () =>
    wsManager.send({
      type: 'execution.resume',
      payload: { runId: executionRunId },
    } as Parameters<typeof wsManager.send>[0])
  const handleCancel = () =>
    wsManager.send({
      type: 'execution.cancel',
      payload: { runId: executionRunId },
    } as Parameters<typeof wsManager.send>[0])

  const taskEntries = Object.entries(taskStatuses)

  const statusLabel: Record<string, string> = {
    running: 'Running',
    paused: 'Paused',
    waiting_approval: 'Awaiting Approval',
    completed: 'Completed',
    failed: 'Failed',
    cancelled: 'Cancelled',
    created: 'Starting…',
    recovering: 'Recovering…',
  }

  return (
    <div className="execution-panel" id="execution-panel">
      {/* Header */}
      <div className="execution-header">
        <span className="execution-header-icon">
          {executionStatus === 'completed'
            ? '✅'
            : executionStatus === 'failed'
            ? '❌'
            : executionStatus === 'cancelled'
            ? '⛔'
            : '⚙️'}
        </span>
        <div className="execution-header-info">
          <div className="execution-title">Production Execution Engine</div>
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

      {/* Active Capability & Adapter Banner */}
      {isActive && (activeCapability || activeAdapterInfo) && (
        <div className="active-capability-banner" id="active-capability-banner">
          <div className="capability-pill">
            <span className="capability-dot" />
            <span className="capability-name">{activeCapability ?? 'Active Task'}</span>
          </div>
          {activeAdapterInfo && (
            <span className="adapter-info-badge">
              ⚡ {activeAdapterInfo}
            </span>
          )}
        </div>
      )}

      {/* Live Browser Activity & Screenshot Preview */}
      {browserActivity && (
        <div className="browser-activity-card" id="browser-activity-card">
          <div className="browser-activity-header">
            <span className="browser-tab-icon">🌐</span>
            <div className="browser-url-wrap">
              {browserActivity.title && (
                <div className="browser-title-text">{browserActivity.title}</div>
              )}
              {browserActivity.url && (
                <div className="browser-url-text" title={browserActivity.url}>
                  {browserActivity.url}
                </div>
              )}
            </div>
            {browserActivity.action && (
              <span className="browser-action-tag">{browserActivity.action}</span>
            )}
          </div>

          {browserActivity.screenshot && (
            <div className="browser-screenshot-wrap">
              <img
                src={browserActivity.screenshot}
                alt="Live browser capture"
                className={`browser-screenshot-img ${isScreenshotExpanded ? 'expanded' : 'compact'}`}
                onClick={() => setIsScreenshotExpanded(!isScreenshotExpanded)}
                id="browser-screenshot-preview"
              />
              <button
                className="screenshot-toggle-btn"
                onClick={() => setIsScreenshotExpanded(!isScreenshotExpanded)}
              >
                {isScreenshotExpanded ? 'Collapse' : 'Expand Preview'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Verification Status Indicator */}
      {verificationStatus && (
        <div
          className={`verification-status-bar ${
            verificationStatus.passed ? 'verification-passed' : 'verification-failed'
          }`}
          id="verification-status-bar"
        >
          <span className="verification-icon">
            {verificationStatus.passed ? '✓' : '⚠️'}
          </span>
          <div className="verification-details">
            <span className="verification-title">
              Independent Verification: {verificationStatus.strategy}
            </span>
            {verificationStatus.details && (
              <span className="verification-subtext">{verificationStatus.details}</span>
            )}
          </div>
        </div>
      )}

      {/* Deterministic Self-Healing Activity */}
      {recoveryAttempts.length > 0 && (
        <div className="self-healing-card" id="self-healing-card">
          <div
            className="self-healing-header"
            onClick={() => setIsRecoveryExpanded(!isRecoveryExpanded)}
          >
            <span>🔄 Deterministic Self-Healing ({recoveryAttempts.length} attempt{recoveryAttempts.length > 1 ? 's' : ''})</span>
            <span className="self-healing-toggle-icon">{isRecoveryExpanded ? '▲' : '▼'}</span>
          </div>
          {isRecoveryExpanded && (
            <div className="self-healing-log">
              {recoveryAttempts.map((att, idx) => (
                <div key={idx} className="self-healing-entry">
                  <span className={`healing-stage-badge healing-stage-${att.stage}`}>
                    {att.stage.toUpperCase()}
                  </span>
                  <span className="healing-message">{att.message}</span>
                  <span className={`healing-status-dot ${att.succeeded ? 'success' : 'fallback'}`}>
                    {att.succeeded ? '✓ Recovered' : '→ Next Stage'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Runtime Permission Prompt */}
      {permissionPrompt && (
        <PermissionPrompt
          request={permissionPrompt}
          runId={executionRunId}
          onDismiss={() => setPermissionPrompt(null)}
        />
      )}

      {/* Approval gate */}
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
              capability={activeCapability ?? 'transform_data'}
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
