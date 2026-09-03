import { useState, useRef } from 'react'
import type { ConversationSummary } from '@usepilot/types'
import './ConversationSearch.css'

interface ConversationSearchProps {
  conversations: ConversationSummary[]
  onSelect: (id: string) => void
  onClose: () => void
}

export function ConversationSearch({ conversations, onSelect, onClose }: ConversationSearchProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = query.trim()
    ? conversations.filter((c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.lastMessagePreview?.toLowerCase().includes(query.toLowerCase())
      )
    : conversations.slice(0, 8)

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'ArrowDown') { setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); return }
    if (e.key === 'ArrowUp') { setSelectedIndex((i) => Math.max(i - 1, 0)); e.preventDefault(); return }
    if (e.key === 'Enter' && filtered[selectedIndex]) {
      onSelect(filtered[selectedIndex].id)
    }
  }

  return (
    <div className="search-overlay" onClick={onClose}>
      <div className="search-modal" onClick={(e) => e.stopPropagation()}>
        <div className="search-input-wrapper">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="search-icon">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            autoFocus
            className="search-input"
            placeholder="Search conversations..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
          />
          <kbd className="search-esc">Esc</kbd>
        </div>
        <div className="search-results">
          {filtered.length === 0 ? (
            <div className="search-empty">No conversations found</div>
          ) : (
            filtered.map((conv, i) => (
              <button
                key={conv.id}
                className={`search-result ${i === selectedIndex ? 'search-result--selected' : ''}`}
                onClick={() => onSelect(conv.id)}
                onMouseEnter={() => setSelectedIndex(i)}
              >
                <div className="search-result__title">{conv.title}</div>
                {conv.lastMessagePreview && (
                  <div className="search-result__preview">{conv.lastMessagePreview}</div>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
