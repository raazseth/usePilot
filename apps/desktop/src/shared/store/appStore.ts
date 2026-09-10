import type { ExecutionStatus, TaskExecutionStatus, ApprovalRequest, JournalEntry, ExecutionMetrics, ExecutionReport, ExecutionResult } from '@usepilot/execution-types'
import type { PlanningStage, ExecutionBlueprint, TaskCapability } from '@usepilot/planner-types'
import { IPCQuery } from '@usepilot/types'
import type { Settings, ConversationSummary } from '@usepilot/types'
import { create } from 'zustand'

import type { PermissionPromptRequest } from '../../components/execution/PermissionPrompt'
import { apiClient } from '../api/client'
import { invokeQuery } from '../api/tauri'
import { wsManager } from '../api/websocket'
import type { WebSocketStatus } from '../api/websocket'



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
  wsStatus: WebSocketStatus

  // Planner state
  planningProgress: PlanningProgressState | null
  activeBlueprint: ExecutionBlueprint | null
  planningError: string | null

  // Execution state
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

  // Capability Runtime state
  browserActivity: {
    url?: string
    title?: string
    screenshot?: string
    activeTab?: number
    action?: string
  } | null
  activeCapability: string | null
  activeAdapterInfo: string | null
  verificationStatus: {
    taskId?: string
    passed: boolean
    strategy: string
    details?: string
  } | null
  recoveryAttempts: Array<{
    timestamp: number
    taskId: string
    stage: string
    message: string
    succeeded: boolean
  }>
  permissionPrompt: PermissionPromptRequest | null

  // Actions
  initialize: () => Promise<void>
  setActiveConversation: (id: string | null) => void
  setConversations: (conversations: ConversationSummary[]) => void
  updateSettings: (patch: Partial<Settings>) => void
  setWsStatus: (status: WebSocketStatus) => void
  setPlanningProgress: (progress: PlanningProgressState | null) => void
  setActiveBlueprint: (blueprint: ExecutionBlueprint | null) => void
  setPlanningError: (error: string | null) => void
  resetPlanning: () => void
  resetExecution: () => void
  setPermissionPrompt: (prompt: PermissionPromptRequest | null) => void
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

  // Execution initial state
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

  // Capability Runtime initial state
  browserActivity: null,
  activeCapability: null,
  activeAdapterInfo: null,
  verificationStatus: null,
  recoveryAttempts: [],
  permissionPrompt: null,

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

      // Register execution WS handlers
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
        const payload = event.payload as { taskId: string; capability?: string; adapterInfo?: string }
        set((s) => ({
          taskStatuses: { ...s.taskStatuses, [payload.taskId]: 'running' },
          activeCapability: payload.capability ?? s.activeCapability,
          activeAdapterInfo: payload.adapterInfo ?? s.activeAdapterInfo,
        }))
      })

      const anyWs = wsManager as unknown as { on: (event: string, handler: (e: { payload: unknown }) => void) => void }

      anyWs.on('execution.browser.activity', (event) => {
        set({ browserActivity: event.payload as AppState['browserActivity'] })
      })

      anyWs.on('execution.verification', (event) => {
        set({ verificationStatus: event.payload as AppState['verificationStatus'] })
      })

      anyWs.on('execution.self_healing', (event) => {
        const item = event.payload as AppState['recoveryAttempts'][0]
        set((s) => ({ recoveryAttempts: [...s.recoveryAttempts, item] }))
      })

      anyWs.on('execution.permission.requested', (event) => {
        set({ permissionPrompt: event.payload as AppState['permissionPrompt'] })
      })

      anyWs.on('execution.permission.resolved', () => {
        set({ permissionPrompt: null })
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
          capability: p.capability as TaskCapability,
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
        const payload = event.payload as { report?: ExecutionReport; result?: ExecutionResult }
        const report = payload.report ?? payload.result?.report ?? null
        set({ executionStatus: 'completed', lastExecutionReport: report })
      })

      wsManager.on('execution.failed', (event) => {
        const payload = event.payload as { errorCode?: string; error?: string }
        set({ executionStatus: 'failed', executionError: payload.errorCode ?? payload.error ?? 'Execution failed' })
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
      browserActivity: null,
      activeCapability: null,
      activeAdapterInfo: null,
      verificationStatus: null,
      recoveryAttempts: [],
      permissionPrompt: null,
    }),

  setPermissionPrompt: (permissionPrompt) => set({ permissionPrompt }),
}))
