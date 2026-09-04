import { create } from 'zustand'
import { apiClient } from '../api/client'
import { wsManager } from '../api/websocket'
import { IPCQuery } from '@usepilot/types'
import { invokeQuery } from '../api/tauri'
import type { Settings, ConversationSummary } from '@usepilot/types'
import type { PlanningStage, ExecutionBlueprint } from '@usepilot/planner-types'

export type AppStatus = 'initializing' | 'ready' | 'error'

export interface PlanningProgressState {
  stage: PlanningStage
  message: string
  progressPct: number
}

interface AppState {
  status: AppStatus
  error: string | null
  backendPort: number | null
  settings: Settings | null
  conversations: ConversationSummary[]
  activeConversationId: string | null
  wsStatus: import('../api/websocket').WebSocketStatus

  // Phase 2: Planner state
  planningProgress: PlanningProgressState | null
  activeBlueprint: ExecutionBlueprint | null
  planningError: string | null

  // Actions
  initialize: () => Promise<void>
  setActiveConversation: (id: string | null) => void
  setConversations: (conversations: ConversationSummary[]) => void
  updateSettings: (patch: Partial<Settings>) => void
  setWsStatus: (status: import('../api/websocket').WebSocketStatus) => void
  setPlanningProgress: (progress: PlanningProgressState | null) => void
  setActiveBlueprint: (blueprint: ExecutionBlueprint | null) => void
  setPlanningError: (error: string | null) => void
  resetPlanning: () => void
}

export const useAppStore = create<AppState>((set, get) => ({
  status: 'initializing',
  error: null,
  backendPort: null,
  settings: null,
  conversations: [],
  activeConversationId: null,
  wsStatus: 'disconnected',
  planningProgress: null,
  activeBlueprint: null,
  planningError: null,

  initialize: async () => {
    try {
      // Get backend port from Tauri, with graceful dev fallback
      let port: number | null = null
      try {
        port = await invokeQuery(IPCQuery.GetBackendPort)
      } catch {
        // Running in pure web / dev mode without Tauri IPC
      }
      if (!port) {
        port = (window as unknown as { __BACKEND_PORT__?: number }).__BACKEND_PORT__ ?? 3001
      }

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

  setPlanningProgress: (planningProgress) => set({ planningProgress, planningError: null }),

  setActiveBlueprint: (activeBlueprint) =>
    set({
      activeBlueprint,
      planningProgress: null,
      planningError: null,
    }),

  setPlanningError: (planningError) =>
    set({
      planningError,
      planningProgress: null,
    }),

  resetPlanning: () =>
    set({
      planningProgress: null,
      activeBlueprint: null,
      planningError: null,
    }),
}))
