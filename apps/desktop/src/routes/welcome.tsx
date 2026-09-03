import { useNavigate } from 'react-router-dom'
import './welcome.css'

export function WelcomeRoute() {
  const navigate = useNavigate()

  return (
    <div className="welcome">
      <div className="welcome__content">
        <div className="welcome__logo">✦</div>
        <h1 className="welcome__title">Welcome to usePilot</h1>
        <p className="welcome__desc">
          Your privacy-first AI assistant. Select a conversation from the sidebar or start a new one.
        </p>
        <button
          id="welcome-new-chat-btn"
          className="welcome__cta"
          onClick={() => navigate('/chat/new')}
        >
          Start a new conversation
        </button>
      </div>
    </div>
  )
}
