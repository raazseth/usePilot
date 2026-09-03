import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAppStore } from './shared/store/appStore'
import { AppShell } from './components/layout/AppShell'
import { ChatRoute } from './routes/chat'
import { SettingsRoute } from './routes/settings'
import { WelcomeRoute } from './routes/welcome'
import { ToastProvider } from './components/ui/Toast'
import { Spinner } from './components/ui/Spinner'

export default function App() {
  const { status, error, initialize } = useAppStore()

  useEffect(() => {
    initialize()
  }, [initialize])

  if (status === 'initializing') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-base)',
        flexDirection: 'column',
        gap: '16px',
      }}>
        <Spinner size="lg" />
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>
          Starting usePilot...
        </p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        background: 'var(--color-bg-base)',
        flexDirection: 'column',
        gap: '12px',
        padding: '32px',
      }}>
        <div style={{ fontSize: '32px' }}>⚠️</div>
        <h1 style={{ color: 'var(--color-text-primary)', fontSize: 'var(--text-xl)', fontWeight: 600 }}>
          Failed to start
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', textAlign: 'center' }}>
          {error ?? 'An unexpected error occurred'}
        </p>
        <button
          onClick={() => initialize()}
          style={{
            marginTop: '8px',
            padding: '8px 20px',
            background: 'var(--color-primary)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
          }}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <AppShell>
          <Routes>
            <Route path="/" element={<WelcomeRoute />} />
            <Route path="/chat/:conversationId" element={<ChatRoute />} />
            <Route path="/settings" element={<SettingsRoute />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppShell>
      </BrowserRouter>
    </ToastProvider>
  )
}
