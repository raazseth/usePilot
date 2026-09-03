import { useState, useRef, useCallback, useEffect } from 'react'
import './ChatInput.css'

interface ChatInputProps {
  onSend: (content: string) => void
  onStop: () => void
  isGenerating: boolean
  disabled?: boolean
}

export function ChatInput({ onSend, onStop, isGenerating, disabled }: ChatInputProps) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed || isGenerating || disabled) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, isGenerating, disabled, onSend])

  const canSend = value.trim().length > 0 && !isGenerating && !disabled

  return (
    <div className="chat-input-wrapper">
      <div className="chat-input-container">
        <textarea
          ref={textareaRef}
          id="chat-textarea"
          className="chat-input-textarea"
          placeholder={disabled ? 'Select a conversation to start chatting' : 'Message usePilot... (Enter to send, Shift+Enter for new line)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          rows={1}
        />
        <div className="chat-input-actions">
          {isGenerating ? (
            <button
              id="stop-generation-btn"
              className="chat-input-btn chat-input-btn--stop"
              onClick={onStop}
              title="Stop generation (Esc)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="4" y="4" width="16" height="16" rx="2" />
              </svg>
              Stop
            </button>
          ) : (
            <button
              id="send-message-btn"
              className={`chat-input-btn chat-input-btn--send ${canSend ? 'chat-input-btn--active' : ''}`}
              onClick={handleSubmit}
              disabled={!canSend}
              title="Send (Enter)"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <p className="chat-input-hint">
        Press <kbd>Enter</kbd> to send · <kbd>Shift+Enter</kbd> for new line
      </p>
    </div>
  )
}
