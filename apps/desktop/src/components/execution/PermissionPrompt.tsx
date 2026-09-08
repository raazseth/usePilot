import { useState } from 'react'

import { wsManager } from '../../shared/api/websocket'
import './execution.css'

export interface PermissionPromptRequest {
  id: string
  capability: string
  resource: string
  scope?: 'once' | 'session' | 'always'
  reason?: string
}

interface PermissionPromptProps {
  request: PermissionPromptRequest
  runId?: string
  onDismiss?: () => void
}

export function PermissionPrompt({ request, runId, onDismiss }: PermissionPromptProps) {
  const [selectedScope, setSelectedScope] = useState<'once' | 'session' | 'always'>('session')
  const [responded, setResponded] = useState(false)

  const sendResponse = (granted: boolean) => {
    if (responded) return
    setResponded(true)

    wsManager.send({
      type: 'execution.permission.response',
      payload: {
        id: request.id,
        runId,
        capability: request.capability,
        resource: request.resource,
        granted,
        scope: granted ? selectedScope : undefined,
      },
    } as unknown as Parameters<typeof wsManager.send>[0])

    if (onDismiss) {
      setTimeout(onDismiss, 600)
    }
  }

  if (responded) {
    return (
      <div className="permission-prompt permission-responded">
        <div className="permission-prompt-header">
          <span>🛡️</span> Permission preference saved
        </div>
      </div>
    )
  }

  return (
    <div className="permission-prompt" id={`permission-prompt-${request.id}`}>
      <div className="permission-prompt-header">
        <span>🛡️</span>
        <span>Capability Permission Requested</span>
      </div>

      <div className="permission-prompt-body">
        <div className="permission-detail-row">
          <span className="permission-label">Capability:</span>
          <span className="permission-value-badge">{request.capability}</span>
        </div>
        <div className="permission-detail-row">
          <span className="permission-label">Target Resource:</span>
          <code className="permission-resource">{request.resource}</code>
        </div>
        {request.reason && (
          <div className="permission-reason">
            {request.reason}
          </div>
        )}
      </div>

      <div className="permission-scope-selector">
        <label className="permission-scope-option">
          <input
            type="radio"
            name="scope"
            value="once"
            checked={selectedScope === 'once'}
            onChange={() => setSelectedScope('once')}
          />
          <span>Allow Once</span>
        </label>
        <label className="permission-scope-option">
          <input
            type="radio"
            name="scope"
            value="session"
            checked={selectedScope === 'session'}
            onChange={() => setSelectedScope('session')}
          />
          <span>Allow for Session</span>
        </label>
        <label className="permission-scope-option">
          <input
            type="radio"
            name="scope"
            value="always"
            checked={selectedScope === 'always'}
            onChange={() => setSelectedScope('always')}
          />
          <span>Always Allow</span>
        </label>
      </div>

      <div className="permission-prompt-actions">
        <button
          id={`perm-grant-${request.id}`}
          className="perm-btn-grant"
          onClick={() => sendResponse(true)}
        >
          ✓ Grant Access
        </button>
        <button
          id={`perm-deny-${request.id}`}
          className="perm-btn-deny"
          onClick={() => sendResponse(false)}
        >
          ✕ Deny
        </button>
      </div>
    </div>
  )
}
