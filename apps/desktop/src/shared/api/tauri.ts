import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  IPCCommand,
  IPCQuery,
  IPCAppEvent,
  IPCCommandPayloads,
  IPCQueryPayloads,
  IPCQueryResults,
} from '@usepilot/types'

/**
 * Typed Tauri IPC client.
 * Never use invoke() or listen() directly — always use these typed wrappers.
 */

/** Invoke a Tauri command (mutation) */
export async function invokeCommand<C extends IPCCommand>(
  command: C,
  payload?: IPCCommandPayloads[C]
): Promise<void> {
  await invoke(command, payload as Record<string, unknown> | undefined)
}

/** Invoke a Tauri query (read) */
export async function invokeQuery<Q extends IPCQuery>(
  query: Q,
  payload?: IPCQueryPayloads[Q]
): Promise<IPCQueryResults[Q]> {
  return invoke(query, payload as Record<string, unknown> | undefined)
}

/** Subscribe to a Tauri event */
export async function listenEvent<T = unknown>(
  event: IPCAppEvent,
  handler: (payload: T) => void
): Promise<() => void> {
  const unlisten = await listen<T>(event, (e) => handler(e.payload))
  return unlisten
}
