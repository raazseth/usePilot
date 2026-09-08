import type { ApprovalRequest } from '@usepilot/execution-types'
import { useState } from 'react'

import { wsManager } from '../../shared/api/websocket'

interface ApprovalPromptProps {
  request: ApprovalRequest
  runId: string
}

export function ApprovalPrompt({ request, runId }: ApprovalPromptProps) {
  const [comment, setComment] = useState('')
  const [responded, setResponded] = useState(false)

  const sendResponse = (approved: boolean) => {
    if (responded) return
    setResponded(true)
    const type = approved ? 'execution.approve' : 'execution.reject'
    wsManager.send({
      type,
      payload: { runId, taskId: request.taskId, comment: comment.trim() || undefined },
    } as Parameters<typeof wsManager.send>[0])
  }

  if (responded) {
    return (
      <div className="approval-prompt" style={{ opacity: 0.5 }}>
        <div className="approval-prompt-header">
          <span>✓</span> Response sent
        </div>
      </div>
    )
  }

  return (
    <div className="approval-prompt" id={`approval-prompt-${request.taskId}`}>
      <div className="approval-prompt-header">
        <span>⚠️</span>
        Manual Approval Required
      </div>
      <div className="approval-prompt-task">
        <strong>Task:</strong> {request.taskTitle}
      </div>
      <div className="approval-prompt-reason">
        {request.approvalReason}
      </div>
      <textarea
        className="approval-prompt-comment"
        placeholder="Optional comment…"
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        id={`approval-comment-${request.taskId}`}
      />
      <div className="approval-prompt-actions">
        <button
          id={`approval-approve-${request.taskId}`}
          className="approval-btn-approve"
          onClick={() => sendResponse(true)}
        >
          ✓ Approve
        </button>
        <button
          id={`approval-reject-${request.taskId}`}
          className="approval-btn-reject"
          onClick={() => sendResponse(false)}
        >
          ✕ Reject
        </button>
      </div>
    </div>
  )
}
