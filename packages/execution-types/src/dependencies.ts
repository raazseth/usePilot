import type { TaskCapability } from '@usepilot/planner-types'

export type DependencyRelationType = 'required' | 'optional' | 'fallback'

export interface SubsystemDependency {
  readonly subsystem: 'browser' | 'desktop' | 'filesystem' | 'vision'
  readonly type: DependencyRelationType
}

export interface PermissionDependency {
  readonly permission: 'browser' | 'filesystem' | 'network' | 'shell' | 'desktop_control'
  readonly type: DependencyRelationType
}

export interface CapabilityDependencyRequirement {
  readonly capability: TaskCapability
  readonly subsystems: readonly SubsystemDependency[]
  readonly permissions: readonly PermissionDependency[]
  /** Convenience list of required subsystems */
  readonly requiredSubsystems: readonly ('browser' | 'desktop' | 'filesystem' | 'vision')[]
  /** Convenience list of required permissions */
  readonly requiredPermissions: readonly ('browser' | 'filesystem' | 'network' | 'shell' | 'desktop_control')[]
}

export const CAPABILITY_DEPENDENCY_GRAPH: Record<TaskCapability, CapabilityDependencyRequirement> = {
  navigate_website: {
    capability: 'navigate_website',
    subsystems: [
      { subsystem: 'browser', type: 'required' },
      { subsystem: 'vision', type: 'optional' },
    ],
    permissions: [
      { permission: 'browser', type: 'required' },
      { permission: 'network', type: 'required' },
    ],
    requiredSubsystems: ['browser'],
    requiredPermissions: ['browser', 'network'],
  },
  download_file: {
    capability: 'download_file',
    subsystems: [
      { subsystem: 'browser', type: 'required' },
      { subsystem: 'filesystem', type: 'required' },
    ],
    permissions: [
      { permission: 'browser', type: 'required' },
      { permission: 'filesystem', type: 'required' },
    ],
    requiredSubsystems: ['browser', 'filesystem'],
    requiredPermissions: ['browser', 'filesystem'],
  },
  read_file: {
    capability: 'read_file',
    subsystems: [
      { subsystem: 'filesystem', type: 'required' },
    ],
    permissions: [
      { permission: 'filesystem', type: 'required' },
    ],
    requiredSubsystems: ['filesystem'],
    requiredPermissions: ['filesystem'],
  },
  write_file: {
    capability: 'write_file',
    subsystems: [
      { subsystem: 'filesystem', type: 'required' },
    ],
    permissions: [
      { permission: 'filesystem', type: 'required' },
    ],
    requiredSubsystems: ['filesystem'],
    requiredPermissions: ['filesystem'],
  },
  move_file: {
    capability: 'move_file',
    subsystems: [
      { subsystem: 'filesystem', type: 'required' },
    ],
    permissions: [
      { permission: 'filesystem', type: 'required' },
    ],
    requiredSubsystems: ['filesystem'],
    requiredPermissions: ['filesystem'],
  },
  delete_file: {
    capability: 'delete_file',
    subsystems: [
      { subsystem: 'filesystem', type: 'required' },
    ],
    permissions: [
      { permission: 'filesystem', type: 'required' },
    ],
    requiredSubsystems: ['filesystem'],
    requiredPermissions: ['filesystem'],
  },
  search_web: {
    capability: 'search_web',
    subsystems: [
      { subsystem: 'browser', type: 'required' },
      { subsystem: 'desktop', type: 'fallback' },
    ],
    permissions: [
      { permission: 'browser', type: 'required' },
      { permission: 'network', type: 'required' },
    ],
    requiredSubsystems: ['browser'],
    requiredPermissions: ['browser', 'network'],
  },
  extract_web_data: {
    capability: 'extract_web_data',
    subsystems: [
      { subsystem: 'browser', type: 'required' },
      { subsystem: 'vision', type: 'optional' },
    ],
    permissions: [
      { permission: 'browser', type: 'required' },
    ],
    requiredSubsystems: ['browser'],
    requiredPermissions: ['browser'],
  },
  authenticate_user: {
    capability: 'authenticate_user',
    subsystems: [
      { subsystem: 'browser', type: 'required' },
      { subsystem: 'vision', type: 'optional' },
    ],
    permissions: [
      { permission: 'browser', type: 'required' },
    ],
    requiredSubsystems: ['browser'],
    requiredPermissions: ['browser'],
  },
  send_communication: {
    capability: 'send_communication',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
      { subsystem: 'browser', type: 'fallback' },
    ],
    permissions: [
      { permission: 'network', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['network'],
  },
  read_communication: {
    capability: 'read_communication',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
      { subsystem: 'browser', type: 'fallback' },
    ],
    permissions: [
      { permission: 'network', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['network'],
  },
  execute_command: {
    capability: 'execute_command',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
    ],
    permissions: [
      { permission: 'shell', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['shell'],
  },
  read_clipboard: {
    capability: 'read_clipboard',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
    ],
    permissions: [
      { permission: 'desktop_control', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['desktop_control'],
  },
  write_clipboard: {
    capability: 'write_clipboard',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
    ],
    permissions: [
      { permission: 'desktop_control', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['desktop_control'],
  },
  call_api: {
    capability: 'call_api',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
    ],
    permissions: [
      { permission: 'network', type: 'required' },
    ],
    requiredSubsystems: ['desktop'],
    requiredPermissions: ['network'],
  },
  transform_data: {
    capability: 'transform_data',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
    ],
    permissions: [],
    requiredSubsystems: ['desktop'],
    requiredPermissions: [],
  },
  verify_state: {
    capability: 'verify_state',
    subsystems: [
      { subsystem: 'desktop', type: 'required' },
      { subsystem: 'browser', type: 'optional' },
      { subsystem: 'filesystem', type: 'optional' },
    ],
    permissions: [],
    requiredSubsystems: ['desktop'],
    requiredPermissions: [],
  },
  none: {
    capability: 'none',
    subsystems: [],
    permissions: [],
    requiredSubsystems: [],
    requiredPermissions: [],
  },
}
