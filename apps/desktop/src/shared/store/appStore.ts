import { create } from 'zustand'
import { apiClient } from '../api/client'
import { wsManager } from '../api/websocket'
import { IPCQuery } from '@usepilot/types'
import { invokeQuery } from '../api/tauri'
import type { Settings, ConversationSummary } from '@usepilot/types'
import type { PlanningStage, ExecutionBlueprint } from '@usepilot/planner-types'
import type { ExecutionStatus, TaskExecutionStatus, ApprovalRequest, JournalEntry, ExecutionMetrics, ExecutionReport, ExecutionResult } from '@usepilot/execution-types'

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

  // Phase 3: Execution state
  executionStatus: ExecutionStatus | null
  executionRunId: string | null
  executionTraceId: string | null
  taskStatuses: Record<string, TaskExecutionStatus>
  taskProgress: { completed: number; total: number; currentTaskTitle: string | null }
  pendingApproval: ApprovalRequest | null
  executionError: string | null
  executionJournal: JournalEntry[]
  executionMetrics: Partial<ExecutionMetrics> | null
  lastExecutionReport: ExecutionReport | null

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
  resetExecution: () => void
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

  // Phase 3 initial state
  executionStatus: null,
  executionRunId: null,
  executionTraceId: null,
  taskStatuses: {},
  taskProgress: { completed: 0, total: 0, currentTaskTitle: null },
  pendingApproval: null,
  executionError: null,
  executionJournal: [],
  executionMetrics: null,
  lastExecutionReport: null,

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

      // Register Phase 3 WS handlers
      wsManager.on('execution.started', (event) => {
        const payload = event.payload
        set({
          executionStatus: 'running',
          executionRunId: payload.runId,
          executionTraceId: payload.traceId,
          taskStatuses: {},
          taskProgress: { completed: 0, total: payload.taskCount, currentTaskTitle: null },
          pendingApproval: null,
          executionError: null,
          executionJournal: [],
          lastExecutionReport: null,
        })
      })

      wsManager.on('execution.progress', (event) => {
        const payload = event.payload
        set({ taskProgress: { completed: payload.completedCount, total: payload.totalCount, currentTaskTitle: payload.currentTaskTitle } })
      })

      wsManager.on('execution.task.started', (event) => {
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [event.payload.taskId]: 'running' } }))
      })

      wsManager.on('execution.task.completed', (event) => {
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [event.payload.taskId]: 'completed' } }))
      })

      wsManager.on('execution.task.failed', (event) => {
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [event.payload.taskId]: 'failed' } }))
      })

      wsManager.on('execution.task.retrying', (event) => {
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [event.payload.taskId]: 'retrying' } }))
      })

      wsManager.on('execution.task.skipped', (event) => {
        set((s) => ({ taskStatuses: { ...s.taskStatuses, [event.payload.taskId]: 'skipped' } }))
      })

      wsManager.on('execution.approval.required', (event) => {
        const p = event.payload
        const req: ApprovalRequest = {
          id: p.requestId,
          runId: p.runId,
          taskId: p.taskId,
          taskTitle: p.taskTitle,
          capability: p.capability as import('@usepilot/planner-types').TaskCapability,
          approvalReason: p.reason ?? '',
          policy: 'mandatory',
          requestedAt: Date.now(),
        }
        set({ pendingApproval: req, executionStatus: 'waiting_approval' })
      })

      wsManager.on('execution.approval.received', () => {
        set({ pendingApproval: null, executionStatus: 'running' })
      })

      wsManager.on('execution.paused', () => {
        set({ executionStatus: 'paused' })
      })

      wsManager.on('execution.resumed', () => {
        set({ executionStatus: 'running' })
      })

      wsManager.on('execution.completed', (event) => {
        const res = event.payload.result as ExecutionResult | undefined
        set({ executionStatus: 'completed', lastExecutionReport: res?.report ?? null })
      })

      wsManager.on('execution.failed', (event) => {
        set({ executionStatus: 'failed', executionError: event.payload.error })
      })

      wsManager.on('execution.cancelled', () => {
        set({ executionStatus: 'cancelled' })
      })

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

  resetExecution: () =>
    set({
      executionStatus: null,
      executionRunId: null,
      executionTraceId: null,
      taskStatuses: {},
      taskProgress: { completed: 0, total: 0, currentTaskTitle: null },
      pendingApproval: null,
      executionError: null,
      executionJournal: [],
      executionMetrics: null,
      lastExecutionReport: null,
    }),
}))
