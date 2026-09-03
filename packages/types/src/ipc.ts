// ─────────────────────────────────────────────────────────────────────────────
// IPC Platform Interface
// Tauri IPC is exposed as typed Commands, Queries, and Events.
// Never use raw string command names outside this file.
// ─────────────────────────────────────────────────────────────────────────────

/** Mutations — cause side effects */
export const IPCCommand = {
  StoreSecret: 'secret_store',
  DeleteSecret: 'secret_delete',
  OpenExternal: 'open_external',
  ShowInFolder: 'show_in_folder',
  SetWindowTitle: 'set_window_title',
} as const

export type IPCCommand = (typeof IPCCommand)[keyof typeof IPCCommand]

/** Reads — no side effects */
export const IPCQuery = {
  GetBackendPort: 'get_backend_port',
  GetSecret: 'secret_get',
  GetAppVersion: 'get_app_version',
  GetAppDataDir: 'get_app_data_dir',
} as const

export type IPCQuery = (typeof IPCQuery)[keyof typeof IPCQuery]

/** Tauri event subscriptions */
export const IPCAppEvent = {
  BackendReady: 'backend:ready',
  BackendError: 'backend:error',
  BackendStopped: 'backend:stopped',
  WindowFocus: 'tauri://focus',
  WindowBlur: 'tauri://blur',
  WindowClose: 'tauri://close-requested',
} as const

export type IPCAppEvent = (typeof IPCAppEvent)[keyof typeof IPCAppEvent]

// ─────────────────────────────────────────────────────────────────────────────
// Typed payloads and return types for all IPC operations
// ─────────────────────────────────────────────────────────────────────────────

export interface IPCCommandPayloads {
  [IPCCommand.StoreSecret]: { key: string; value: string }
  [IPCCommand.DeleteSecret]: { key: string }
  [IPCCommand.OpenExternal]: { url: string }
  [IPCCommand.ShowInFolder]: { path: string }
  [IPCCommand.SetWindowTitle]: { title: string }
}

export interface IPCQueryPayloads {
  [IPCQuery.GetBackendPort]: void
  [IPCQuery.GetSecret]: { key: string }
  [IPCQuery.GetAppVersion]: void
  [IPCQuery.GetAppDataDir]: void
}

export interface IPCQueryResults {
  [IPCQuery.GetBackendPort]: number
  [IPCQuery.GetSecret]: string | null
  [IPCQuery.GetAppVersion]: string
  [IPCQuery.GetAppDataDir]: string
}
