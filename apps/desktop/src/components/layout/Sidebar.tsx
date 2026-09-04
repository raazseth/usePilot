import { useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAppStore } from '../../shared/store/appStore'
import { apiClient } from '../../shared/api/client'
import { formatRelativeTime } from '@usepilot/utils'
import { ConversationSearch } from '../chat/ConversationSearch'
import type { ConversationSummary } from '@usepilot/types'
import './Sidebar.css'

export function Sidebar() {
  const navigate = useNavigate()
  const { conversationId } = useParams<{ conversationId: string }>()
  const { conversations, setConversations, wsStatus } = useAppStore()
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleNewConversation = useCallback(async () => {
    try {
      const conversation = await apiClient.post<ConversationSummary>('/conversations', {
        title: 'New Conversation',
      })
      const all = await apiClient.get<ConversationSummary[]>('/conversations')
      setConversations(all)
      navigate(`/chat/${conversation.id}`)
    } catch (error) {
      console.error('Failed to create conversation:', error)
    }
  }, [navigate, setConversations])

  const handlePlanTask = useCallback(async () => {
    try {
      const conversation = await apiClient.post<ConversationSummary>('/conversations', {
        title: 'Task Plan',
      })
      const all = await apiClient.get<ConversationSummary[]>('/conversations')
      setConversations(all)
      navigate(`/chat/${conversation.id}`)
    } catch (error) {
      console.error('Failed to create task plan conversation:', error)
    }
  }, [navigate, setConversations])

  const handleDelete = useCallback(
    async (e: React.MouseEvent, id: string) => {
      e.stopPropagation()
      e.preventDefault()
      setDeletingId(id)
      try {
        await apiClient.delete(`/conversations/${id}`)
        const all = await apiClient.get<ConversationSummary[]>('/conversations')
        setConversations(all)
        if (conversationId === id) {
          navigate('/')
        }
      } catch (error) {
        console.error('Failed to delete conversation:', error)
      } finally {
        setDeletingId(null)
      }
    },
    [conversationId, navigate, setConversations]
  )

  const wsIndicatorClass = wsStatus === 'connected' ? 'connected' : wsStatus === 'connecting' ? 'connecting' : 'disconnected'

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <div className="sidebar__logo">✦</div>
          <span className="sidebar__brand-name">usePilot</span>
          <div className={`sidebar__ws-indicator ${wsIndicatorClass}`} title={`WebSocket: ${wsStatus}`} />
        </div>
        <button
          id="new-conversation-btn"
          className="sidebar__new-btn"
          onClick={handleNewConversation}
          title="New Conversation (⌘N)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="sidebar__search-row">
        <button
          id="search-conversations-btn"
          className="sidebar__search-btn"
          onClick={() => setIsSearchOpen(true)}
          title="Search (⌘K)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <span>Search conversations...</span>
          <kbd>⌘K</kbd>
        </button>
      </div>

      {/* Quick Action: Plan a Task */}
      <div className="sidebar__action-row">
        <button
          id="plan-task-btn"
          className="sidebar__plan-btn"
          onClick={handlePlanTask}
          title="Plan an automation task with AI"
        >
          <span className="sidebar__plan-icon">🧠</span>
          <span className="sidebar__plan-text">Plan a Task</span>
          <span className="sidebar__plan-badge">AI Plan</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="sidebar__conversations">
        {conversations.length === 0 ? (
          <div className="sidebar__empty">
            <p>No conversations yet</p>
            <button onClick={handleNewConversation} className="sidebar__empty-cta">
              Start a conversation
            </button>
          </div>
        ) : (
          conversations.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isActive={conv.id === conversationId}
              isDeleting={deletingId === conv.id}
              onDelete={handleDelete}
              onClick={() => navigate(`/chat/${conv.id}`)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="sidebar__footer">
        <button
          id="settings-btn"
          className="sidebar__settings-btn"
          onClick={() => navigate('/settings')}
          title="Settings (⌘,)"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Settings
        </button>
      </div>

      {isSearchOpen && (
        <ConversationSearch
          conversations={conversations}
          onSelect={(id) => { navigate(`/chat/${id}`); setIsSearchOpen(false) }}
          onClose={() => setIsSearchOpen(false)}
        />
      )}
    </aside>
  )
}

interface ConversationItemProps {
  conversation: ConversationSummary
  isActive: boolean
  isDeleting: boolean
  onClick: () => void
  onDelete: (e: React.MouseEvent, id: string) => void
}

function ConversationItem({ conversation, isActive, isDeleting, onClick, onDelete }: ConversationItemProps) {
  return (
    <div
      className={`conv-item ${isActive ? 'conv-item--active' : ''} ${isDeleting ? 'conv-item--deleting' : ''}`}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div className="conv-item__content">
        <div className="conv-item__title">{conversation.title}</div>
        {conversation.lastMessagePreview && (
          <div className="conv-item__preview">{conversation.lastMessagePreview}</div>
        )}
      </div>
      <div className="conv-item__meta">
        <span className="conv-item__time">
          {formatRelativeTime(conversation.updatedAt)}
        </span>
        <button
          className="conv-item__delete"
          onClick={(e) => onDelete(e, conversation.id)}
          title="Delete conversation"
          aria-label="Delete conversation"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6 6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
