// StubAdapter — simulates all capabilities, exercises the full runtime path

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  AdapterFactory,
 VerificationResult } from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'

export class StubAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 0
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = []
  readonly name = 'StubAdapter'

  constructor(capability: TaskCapability) {
    this.capability = capability
  }

  async initialize(): Promise<void> {
    // No-op stub
  }

  async execute(ctx: AdapterContext): Promise<AdapterResult> {
    const durationMs = Math.floor(Math.random() * 150) + 50
    await new Promise((r) => setTimeout(r, durationMs))

    if (ctx.signal.aborted) {
      return {
        success: false,
        error: 'Execution cancelled',
        failureCategory: 'cancellation',
        durationMs,
      }
    }

    return {
      success: true,
      output: {
        simulated: true,
        capability: this.capability,
        taskId: ctx.task.id,
        taskTitle: ctx.task.title,
        adapterName: this.name,
      },
      durationMs,
    }
  }

  async verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult> {
    const start = Date.now()

    if (!result.success) {
      return {
        passed: false,
        checkedConditions: [],
        failedConditions: ctx.task.successConditions,
        strategy: 'state_check',
        notes: 'Adapter execution failed — skipping verification',
        durationMs: Date.now() - start,
      }
    }

    return {
      passed: true,
      checkedConditions: ctx.task.successConditions,
      failedConditions: [],
      strategy: 'state_check',
      notes: 'Stub verification — all conditions simulated as passed',
      durationMs: Date.now() - start,
    }
  }

  async cleanup(): Promise<void> {
    // No-op stub
  }

  async dispose(): Promise<void> {
    // No-op stub
  }

  async isAvailable(): Promise<boolean> {
    return true
  }
}

export const ALL_CAPABILITIES: TaskCapability[] = [
  'navigate_website',
  'download_file',
  'read_file',
  'write_file',
  'move_file',
  'delete_file',
  'search_web',
  'extract_web_data',
  'authenticate_user',
  'send_communication',
  'read_communication',
  'execute_command',
  'read_clipboard',
  'write_clipboard',
  'call_api',
  'transform_data',
  'verify_state',
  'none',
]

export const createStubAdapterFactory = (capability: TaskCapability): AdapterFactory => {
  return (_config?) => new StubAdapter(capability)
}
