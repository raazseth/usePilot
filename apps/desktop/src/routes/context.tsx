import { useState } from 'react'

import './context.css'

export function ContextRoute() {
  const [activeTab, setActiveTab] = useState<'runtime' | 'knowledge' | 'observations' | 'history' | 'indexes'>('runtime')
  const [searchQuery, setSearchQuery] = useState('')
  const [replayStep, setReplayStep] = useState(0)

  // Example live state cards
  const mockBrowserState = {
    currentUrl: 'https://amazon.in/gp/css/order-history',
    pageTitle: 'Your Orders',
    domain: 'amazon.in',
    authenticatedDomains: ['amazon.in', 'github.com'],
    tabCount: 2,
    provenance: { source: 'browser', confidence: 0.98, adapter: 'PlaywrightBrowserAdapter' },
  }

  const mockDesktopState = {
    activeWindowTitle: 'Visual Studio Code - usePilot',
    focusedProcessId: 18420,
    clipboardSnippet: 'INV-2026-9921',
    provenance: { source: 'desktop', confidence: 1.0, adapter: 'NativeDesktopAdapter' },
  }

  const mockFilesystemState = {
    currentWorkingDirectory: 'E:\\usePilot',
    activeDownloads: ['invoice_jan_2026.pdf'],
    recentPaths: ['E:\\usePilot\\downloads\\invoice_jan_2026.pdf', 'E:\\usePilot\\package.json'],
    provenance: { source: 'filesystem', confidence: 1.0, adapter: 'NativeFilesystemAdapter' },
  }

  const mockObservations = [
    {
      id: 'obs-001',
      type: 'browser_state',
      source: 'browser',
      confidence: 0.98,
      timestamp: Date.now() - 45000,
      summary: 'Navigated to Amazon Order History',
      payload: { url: 'https://amazon.in/gp/css/order-history', interactiveCount: 14 },
    },
    {
      id: 'obs-002',
      type: 'filesystem_state',
      source: 'filesystem',
      confidence: 1.0,
      timestamp: Date.now() - 30000,
      summary: 'Verified invoice download integrity',
      payload: { path: 'downloads/invoice_jan_2026.pdf', sizeBytes: 154200, sha256: '9f83...bc01' },
    },
    {
      id: 'obs-003',
      type: 'verification_state',
      source: 'execution',
      confidence: 1.0,
      timestamp: Date.now() - 12000,
      summary: 'State assertion satisfied',
      payload: { strategy: 'FilesystemVerifier', passes: true },
    },
  ]

  const mockKnowledgeDomains = [
    {
      domain: 'amazon.in',
      pagesCount: 6,
      authenticated: true,
      routes: ['/gp/css/order-history', '/gp/your-account', '/cart'],
      lastDiscovered: '2 mins ago',
    },
    {
      domain: 'github.com',
      pagesCount: 12,
      authenticated: true,
      routes: ['/pulls', '/issues', '/notifications'],
      lastDiscovered: '10 mins ago',
    },
  ]

  const mockIndexedDocs = [
    {
      id: 'idx-1',
      type: 'pdf',
      title: 'Amazon GST Tax Invoice Jan 2026',
      tags: ['invoice', 'gst', 'amazon'],
      matchScore: 0.96,
    },
    {
      id: 'idx-2',
      type: 'document',
      title: 'Architecture Blueprint - Phase 5',
      tags: ['planning', 'spec'],
      matchScore: 0.88,
    },
  ]

  return (
    <div className="context-page">
      <header className="context-header">
        <div className="context-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
          </svg>
          Runtime Context Layer
        </div>
        <div className="context-tabs">
          <button
            className={`context-tab-btn ${activeTab === 'runtime' ? 'active' : ''}`}
            onClick={() => setActiveTab('runtime')}
          >
            Runtime
          </button>
          <button
            className={`context-tab-btn ${activeTab === 'knowledge' ? 'active' : ''}`}
            onClick={() => setActiveTab('knowledge')}
          >
            Knowledge
          </button>
          <button
            className={`context-tab-btn ${activeTab === 'observations' ? 'active' : ''}`}
            onClick={() => setActiveTab('observations')}
          >
            Observations
          </button>
          <button
            className={`context-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            History
          </button>
          <button
            className={`context-tab-btn ${activeTab === 'indexes' ? 'active' : ''}`}
            onClick={() => setActiveTab('indexes')}
          >
            Indexes
          </button>
        </div>
      </header>

      <main className="context-content">
        {/* Tab 1: Runtime State */}
        {activeTab === 'runtime' && (
          <div className="context-grid">
            <div className="context-card">
              <div className="context-card-header">
                <span>Browser State</span>
                <span className="badge-source">{mockBrowserState.provenance.source}</span>
              </div>
              <div className="context-stat-row">
                <span>Current URL</span>
                <span className="context-stat-val">{mockBrowserState.currentUrl}</span>
              </div>
              <div className="context-stat-row">
                <span>Page Title</span>
                <span className="context-stat-val">{mockBrowserState.pageTitle}</span>
              </div>
              <div className="context-stat-row">
                <span>Active Domain</span>
                <span className="context-stat-val">{mockBrowserState.domain}</span>
              </div>
              <div className="context-stat-row">
                <span>Confidence</span>
                <span className="badge-confidence">{mockBrowserState.provenance.confidence * 100}%</span>
              </div>
            </div>

            <div className="context-card">
              <div className="context-card-header">
                <span>Desktop State</span>
                <span className="badge-source">{mockDesktopState.provenance.source}</span>
              </div>
              <div className="context-stat-row">
                <span>Active Window</span>
                <span className="context-stat-val">{mockDesktopState.activeWindowTitle}</span>
              </div>
              <div className="context-stat-row">
                <span>Process PID</span>
                <span className="context-stat-val">{mockDesktopState.focusedProcessId}</span>
              </div>
              <div className="context-stat-row">
                <span>Clipboard</span>
                <span className="context-stat-val">{mockDesktopState.clipboardSnippet}</span>
              </div>
            </div>

            <div className="context-card">
              <div className="context-card-header">
                <span>Filesystem State</span>
                <span className="badge-source">{mockFilesystemState.provenance.source}</span>
              </div>
              <div className="context-stat-row">
                <span>Working Directory</span>
                <span className="context-stat-val">{mockFilesystemState.currentWorkingDirectory}</span>
              </div>
              <div className="context-stat-row">
                <span>Active Downloads</span>
                <span className="context-stat-val">{mockFilesystemState.activeDownloads.join(', ')}</span>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Knowledge Graph */}
        {activeTab === 'knowledge' && (
          <div className="context-grid">
            {mockKnowledgeDomains.map((kd) => (
              <div key={kd.domain} className="context-card">
                <div className="context-card-header">
                  <span>{kd.domain}</span>
                  <span className="badge-confidence">Authenticated</span>
                </div>
                <div className="context-stat-row">
                  <span>Discovered Routes</span>
                  <span className="context-stat-val">{kd.pagesCount}</span>
                </div>
                <div className="context-stat-row">
                  <span>Sample Paths</span>
                  <span className="context-stat-val">{kd.routes.join(', ')}</span>
                </div>
                <div className="context-stat-row">
                  <span>Last Discovered</span>
                  <span className="context-stat-val">{kd.lastDiscovered}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 3: Typed Observations Stream */}
        {activeTab === 'observations' && (
          <div className="obs-stream">
            {mockObservations.map((obs) => (
              <div key={obs.id} className="obs-item">
                <div className="obs-item-meta">
                  <span className="badge-source">{obs.source}</span>
                  <span>{obs.type}</span>
                  <span className="badge-confidence">{(obs.confidence * 100).toFixed(0)}%</span>
                </div>
                <div className="obs-item-title">{obs.summary}</div>
                <div className="obs-item-json">{JSON.stringify(obs.payload, null, 2)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Tab 4: Replay & History */}
        {activeTab === 'history' && (
          <div className="context-card">
            <div className="context-card-header">
              <span>Observation Replay Viewer</span>
              <span>Step {replayStep + 1} of 3</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                className="context-tab-btn active"
                onClick={() => setReplayStep(Math.max(0, replayStep - 1))}
                disabled={replayStep === 0}
              >
                ◀ Step Back
              </button>
              <button
                className="context-tab-btn active"
                onClick={() => setReplayStep(Math.min(2, replayStep + 1))}
                disabled={replayStep === 2}
              >
                Step Forward ▶
              </button>
            </div>
            <div className="obs-item-json" style={{ marginTop: '14px' }}>
              {JSON.stringify(mockObservations[replayStep], null, 2)}
            </div>
          </div>
        )}

        {/* Tab 5: Runtime Index */}
        {activeTab === 'indexes' && (
          <div>
            <div className="search-container">
              <input
                type="text"
                className="search-input"
                placeholder="Search indexed PDFs, documents, downloads, OCR, and clipboard..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="context-grid">
              {mockIndexedDocs.map((doc) => (
                <div key={doc.id} className="context-card">
                  <div className="context-card-header">
                    <span>{doc.title}</span>
                    <span className="badge-source">{doc.type}</span>
                  </div>
                  <div className="context-stat-row">
                    <span>Tags</span>
                    <span className="context-stat-val">{doc.tags.join(', ')}</span>
                  </div>
                  <div className="context-stat-row">
                    <span>Relevance</span>
                    <span className="badge-confidence">{(doc.matchScore * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
