import './EmptyState.css'

interface EmptyStateProps {
  onPromptSelect: (prompt: string) => void
}

const SUGGESTED_PROMPTS = [
  'Explain quantum entanglement in simple terms',
  'Write a Python function to parse JSON and handle errors',
  'Help me plan a healthy daily routine',
  'Summarize the key ideas from Atomic Habits',
  'Draft a professional email to decline a meeting',
  'What are the best practices for REST API design?',
]

export function EmptyState({ onPromptSelect }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__hero">
        <div className="empty-state__logo">✦</div>
        <h1 className="empty-state__title">How can I help you?</h1>
        <p className="empty-state__subtitle">
          I'm your local AI assistant. Everything runs on your device — no data leaves.
        </p>
      </div>

      <div className="empty-state__prompts">
        {SUGGESTED_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            className="empty-state__prompt"
            onClick={() => onPromptSelect(prompt)}
          >
            {prompt}
          </button>
        ))}
      </div>
    </div>
  )
}
