import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MessageBubble } from '../components/chat/MessageBubble'
import { ChatInput } from '../components/chat/ChatInput'
import { EmptyState } from '../components/chat/EmptyState'
import type { Message } from '@usepilot/types'

describe('MessageBubble', () => {
  it('renders user message', () => {
    const message: Message = {
      id: 'm1',
      conversationId: 'c1',
      role: 'user',
      content: 'Can you explain DDD?',
      metadata: null,
      attachments: null,
      toolCalls: null,
      toolResults: null,
      status: 'complete',
      createdAt: Date.now(),
      deletedAt: null,
    }

    render(<MessageBubble message={message} />)
    expect(screen.getByText('Can you explain DDD?')).toBeDefined()
  })

  it('renders assistant markdown content', () => {
    const message: Message = {
      id: 'm2',
      conversationId: 'c1',
      role: 'assistant',
      content: 'Domain-Driven Design is an approach to software development.',
      metadata: null,
      attachments: null,
      toolCalls: null,
      toolResults: null,
      status: 'complete',
      createdAt: Date.now(),
      deletedAt: null,
    }

    render(<MessageBubble message={message} />)
    expect(screen.getByText(/Domain-Driven Design/)).toBeDefined()
  })
})

describe('ChatInput', () => {
  it('submits on send button click', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(<ChatInput onSend={onSend} onStop={onStop} isGenerating={false} />)

    const textarea = screen.getByPlaceholderText(/Message usePilot/i)
    fireEvent.change(textarea, { target: { value: 'Hello assistant' } })

    const sendBtn = screen.getByTitle(/Send/i)
    fireEvent.click(sendBtn)

    expect(onSend).toHaveBeenCalledWith('Hello assistant')
  })

  it('renders stop button when isGenerating is true', () => {
    const onSend = vi.fn()
    const onStop = vi.fn()

    render(<ChatInput onSend={onSend} onStop={onStop} isGenerating={true} />)

    const stopBtn = screen.getByTitle(/Stop generation/i)
    expect(stopBtn).toBeDefined()

    fireEvent.click(stopBtn)
    expect(onStop).toHaveBeenCalled()
  })
})

describe('EmptyState', () => {
  it('triggers prompt select when a suggestion card is clicked', () => {
    const onSelect = vi.fn()
    render(<EmptyState onPromptSelect={onSelect} />)

    const promptCard = screen.getByText(/Explain quantum entanglement/i)
    fireEvent.click(promptCard)

    expect(onSelect).toHaveBeenCalledWith('Explain quantum entanglement in simple terms')
  })
})
