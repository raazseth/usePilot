import { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message } from '@usepilot/types'
import { CodeBlock } from '../ui/CodeBlock'
import './MessageBubble.css'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
}

export function MessageBubble({ message, isStreaming }: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isEmpty = !message.content && isStreaming

  const handleCopy = useCallback(async () => {
    if (!message.content) return
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  return (
    <div className={`message ${isUser ? 'message--user' : 'message--assistant'} fade-in`}>
      {/* Avatar / Role indicator */}
      <div className={`message__avatar ${isUser ? 'message__avatar--user' : 'message__avatar--assistant'}`}>
        {isUser ? (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
          </svg>
        ) : (
          <span style={{ fontSize: '12px' }}>✦</span>
        )}
      </div>

      {/* Message content */}
      <div className="message__body">
        <div className={`message__content selectable ${isStreaming && !message.content ? 'message__content--loading' : ''}`}>
          {isEmpty ? (
            <div className="message__thinking">
              <span />
              <span />
              <span />
            </div>
          ) : isUser ? (
            <p className="message__user-text">{message.content}</p>
          ) : (
            <div className={`message__markdown ${isStreaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className ?? '')
                    const isBlock = !!match
                    if (isBlock) {
                      return (
                        <CodeBlock
                          language={match![1]}
                          code={String(children).replace(/\n$/, '')}
                        />
                      )
                    }
                    return <code className="message__inline-code" {...props}>{children}</code>
                  },
                }}
              >
                {message.content ?? ''}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Actions */}
        {isAssistant && message.content && !isStreaming && (
          <div className="message__actions">
            <button
              className={`message__action-btn ${copied ? 'message__action-btn--success' : ''}`}
              onClick={handleCopy}
              title="Copy response"
            >
              {copied ? (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                  Copied
                </>
              ) : (
                <>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        )}

        {/* Error state */}
        {message.status === 'error' && (
          <div className="message__error">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
            </svg>
            Generation failed
          </div>
        )}
      </div>
    </div>
  )
}
