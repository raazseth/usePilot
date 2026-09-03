import { create } from 'zustand'
import { apiClient } from '../api/client'
import { wsManager } from '../api/websocket'
import { IPCQuery } from '@usepilot/types'
import { invokeQuery } from '../api/tauri'
import type { Settings, ConversationSummary } from '@usepilot/types'

export type AppStatus = 'initializing' | 'ready' | 'error'

interface AppState {
  status: AppStatus
  error: string | null
  backendPort: number | null
  settings: Settings | null
  conversations: ConversationSummary[]
  activeConversationId: string | null
  wsStatus: import('../api/websocket').WebSocketStatus

  // Actions
  initialize: () => Promise<void>
  setActiveConversation: (id: string | null) => void
  setConversations: (conversations: ConversationSummary[]) => void
  updateSettings: (patch: Partial<Settings>) => void
  setWsStatus: (status: import('../api/websocket').WebSocketStatus) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'initializing',
  error: null,
  backendPort: null,
  settings: null,
  conversations: [],
  activeConversationId: null,
  wsStatus: 'disconnected',

  initialize: async () => {
    try {
      // Get backend port from Tauri
      const port = await invokeQuery(IPCQuery.GetBackendPort)
      if (!port) throw new Error('Backend port not available')

      apiClient.updatePort(port)

      // Connect WebSocket
      const wsUrl = `ws://localhost:${port}`
      wsManager.connect(wsUrl)
      wsManager.onStatusChange((s) => get().setWsStatus(s))

      // Load initial data
      const [settings, conversations] = await Promise.all([
        apiClient.get<Settings>('/settings'),
        apiClient.get<ConversationSummary[]>('/conversations'),
      ])

      set({
        status: 'ready',
        backendPort: port,
        settings,
        conversations,
      })
    } catch (error) {
      set({
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to initialize',
      })
    }
  },

  setActiveConversation: (id) => set({ activeConversationId: id }),

  setConversations: (conversations) => set({ conversations }),

  updateSettings: (patch) =>
    set((s) => ({
      settings: s.settings ? { ...s.settings, ...patch } : null,
    })),

  setWsStatus: (wsStatus) => set({ wsStatus }),
}))
