import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '../shared/store/appStore'
import { apiClient } from '../shared/api/client'
import { useToast } from '../components/ui/Toast'
import type { Settings, AIModel } from '@usepilot/types'
import './settings.css'

export function SettingsRoute() {
  const { settings, updateSettings } = useAppStore()
  const { toast } = useToast()
  const [saving, setSaving] = useState(false)
  const [availableModels, setAvailableModels] = useState<AIModel[]>([])
  const [form, setForm] = useState({
    theme: settings?.theme ?? 'dark',
    defaultModel: settings?.defaultModel ?? 'qwen2.5-coder:3b',
    temperature: settings?.temperature ?? '0.7',
    streamingEnabled: settings?.streamingEnabled ?? true,
  })

  // Load installed models dynamically from active provider
  useEffect(() => {
    apiClient
      .get<AIModel[]>('/providers/models')
      .then((models) => {
        if (models && models.length > 0) {
          setAvailableModels(models)
          setForm((f) => {
            const valid = models.some((m) => m.id === f.defaultModel)
            return valid ? f : { ...f, defaultModel: models[0]?.id ?? 'qwen2.5-coder:3b' }
          })
        } else {
          // Fallback to installed local models
          setAvailableModels([
            { id: 'qwen2.5-coder:3b', name: 'qwen2.5-coder:3b' },
            { id: 'deepseek-v4-flash:cloud', name: 'deepseek-v4-flash:cloud' },
          ])
        }
      })
      .catch(() => {
        setAvailableModels([
          { id: 'qwen2.5-coder:3b', name: 'qwen2.5-coder:3b' },
          { id: 'deepseek-v4-flash:cloud', name: 'deepseek-v4-flash:cloud' },
        ])
      })
  }, [])

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      const updated = await apiClient.patch<Settings>('/settings', form)
      updateSettings(updated)
      toast('Settings saved', 'success')
    } catch {
      toast('Failed to save settings', 'error')
    } finally {
      setSaving(false)
    }
  }, [form, updateSettings, toast])

  return (
    <div className="settings-route">
      <div className="settings-content">
        <header className="settings-header">
          <h1 className="settings-title">Settings</h1>
          <p className="settings-subtitle">Configure your usePilot experience</p>
        </header>

        <div className="settings-sections">
          {/* Appearance */}
          <section className="settings-section">
            <h2 className="settings-section-title">Appearance</h2>
            <div className="settings-field">
              <label className="settings-label" htmlFor="theme-select">Theme</label>
              <select
                id="theme-select"
                className="settings-select"
                value={form.theme}
                onChange={(e) => setForm((f) => ({ ...f, theme: e.target.value as Settings['theme'] }))}
              >
                <option value="dark">Dark</option>
                <option value="light">Light</option>
                <option value="system">System</option>
              </select>
            </div>
          </section>

          {/* AI Model */}
          <section className="settings-section">
            <h2 className="settings-section-title">AI Model</h2>
            <div className="settings-field">
              <label className="settings-label" htmlFor="model-select">Default Model</label>
              <select
                id="model-select"
                className="settings-select"
                value={form.defaultModel}
                onChange={(e) => setForm((f) => ({ ...f, defaultModel: e.target.value }))}
              >
                {availableModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name || model.id}
                  </option>
                ))}
              </select>
              <p className="settings-hint">
                Select from installed models available in your active provider
              </p>
            </div>

            <div className="settings-field">
              <label className="settings-label" htmlFor="temperature-input">
                Temperature
                <span className="settings-label-value">{form.temperature}</span>
              </label>
              <input
                id="temperature-input"
                className="settings-range"
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={form.temperature}
                onChange={(e) => setForm((f) => ({ ...f, temperature: e.target.value }))}
              />
              <div className="settings-range-labels">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>

            <div className="settings-field">
              <label className="settings-label settings-label--row" htmlFor="streaming-toggle">
                Enable Streaming
                <input
                  id="streaming-toggle"
                  type="checkbox"
                  checked={form.streamingEnabled}
                  onChange={(e) => setForm((f) => ({ ...f, streamingEnabled: e.target.checked }))}
                  className="settings-checkbox"
                />
              </label>
              <p className="settings-hint">Show responses as they generate token by token</p>
            </div>
          </section>

          {/* About */}
          <section className="settings-section">
            <h2 className="settings-section-title">About</h2>
            <div className="settings-about">
              <div className="settings-about-logo">✦</div>
              <div>
                <p className="settings-about-name">usePilot</p>
                <p className="settings-about-version">Version 0.1.0 — Phase 1</p>
                <p className="settings-about-desc">Privacy-first local AI assistant</p>
              </div>
            </div>
          </section>
        </div>

        <div className="settings-actions">
          <button
            id="save-settings-btn"
            className="settings-save-btn"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  )
}
