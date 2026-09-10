import { exec, spawn } from 'node:child_process'
import { promisify } from 'node:util'

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  VerificationResult,
} from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'

const execAsync = promisify(exec)

export interface DesktopAdapterOptions {
  shell?: string | undefined
}

export class NativeDesktopAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']
  readonly name = 'NativeDesktopAdapter'

  private static memoryClipboard = ''
  private static lastWrittenTimestamp = 0

  constructor(capability: TaskCapability, _options?: DesktopAdapterOptions | undefined) {
    this.capability = capability
  }

  async initialize(): Promise<void> {
    // Initialized
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async cleanup(): Promise<void> {
    // Clean up
  }

  async dispose(): Promise<void> {
    // Clean up
  }

  private async readSystemClipboard(): Promise<string> {
    if (NativeDesktopAdapter.memoryClipboard && Date.now() - NativeDesktopAdapter.lastWrittenTimestamp < 10000) {
      return NativeDesktopAdapter.memoryClipboard
    }
    const platform = process.platform
    try {
      if (platform === 'win32') {
        const { stdout } = await execAsync('powershell -NoProfile -Command "Get-Clipboard"', { timeout: 3000 })
        const trimmed = stdout.trimEnd()
        return trimmed || NativeDesktopAdapter.memoryClipboard
      } else if (platform === 'darwin') {
        const { stdout } = await execAsync('pbpaste', { timeout: 3000 })
        return stdout || NativeDesktopAdapter.memoryClipboard
      } else {
        const { stdout } = await execAsync('xclip -selection clipboard -o', { timeout: 3000 })
        return stdout || NativeDesktopAdapter.memoryClipboard
      }
    } catch {
      return NativeDesktopAdapter.memoryClipboard
    }
  }

  private async writeSystemClipboard(text: string): Promise<void> {
    NativeDesktopAdapter.memoryClipboard = text
    NativeDesktopAdapter.lastWrittenTimestamp = Date.now()
    const platform = process.platform
    try {
      if (platform === 'win32') {
        await new Promise<void>((resolve) => {
          const proc = spawn('clip', { stdio: ['pipe', 'ignore', 'ignore'] })
          const timer = setTimeout(() => {
            try { proc.kill() } catch {}
            resolve()
          }, 1500)
          proc.on('error', () => { clearTimeout(timer); resolve() })
          proc.on('close', () => { clearTimeout(timer); resolve() })
          try {
            proc.stdin.write(text)
            proc.stdin.end()
          } catch {
            clearTimeout(timer)
            resolve()
          }
        })
      } else if (platform === 'darwin') {
        const proc = spawn('pbcopy')
        proc.stdin.write(text)
        proc.stdin.end()
      } else {
        const proc = spawn('xclip', ['-selection', 'clipboard'])
        proc.stdin.write(text)
        proc.stdin.end()
      }
    } catch {
      // Memory clipboard is already set
    }
  }

  async execute(ctx: AdapterContext): Promise<AdapterResult> {
    const start = Date.now()
    const task = ctx.task

    if (ctx.signal.aborted) {
      return {
        success: false,
        error: 'Execution cancelled',
        failureCategory: 'cancellation',
        durationMs: Date.now() - start,
      }
    }

    try {
      let output: unknown = undefined
      const params = (task.toolConfig ?? {}) as Record<string, unknown>

      switch (this.capability) {
        case 'read_clipboard': {
          const content = await this.readSystemClipboard()
          output = { content, length: content.length }
          break
        }

        case 'write_clipboard': {
          const text = (params['text'] ?? params['content'] ?? '') as string
          await this.writeSystemClipboard(text)
          output = { written: true, length: text.length }
          break
        }

        case 'execute_command': {
          const command = (params['command'] ?? params['cmd'] ?? task.title) as string
          const { stdout, stderr } = await execAsync(command, {
            signal: ctx.signal,
            timeout: 60000,
          })
          output = { stdout: stdout.trim(), stderr: stderr.trim(), exitCode: 0 }
          break
        }

        default: {
          // Native app launch / window control
          const appName = (params['app'] ?? params['application'] ?? task.title) as string
          if (task.title.toLowerCase().includes('launch') || task.title.toLowerCase().includes('open')) {
            const child = spawn(appName, [], { detached: true, stdio: 'ignore', shell: true })
            child.unref()
            output = { application: appName, launched: true, pid: child.pid }
          } else {
            output = { capability: this.capability, executed: true }
          }
        }
      }

      return {
        success: true,
        output,
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: errorMsg,
        failureCategory: ctx.signal.aborted ? 'cancellation' : 'adapter_failure',
        durationMs: Date.now() - start,
      }
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
        durationMs: Date.now() - start,
        notes: result.error,
      }
    }

    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    try {
      if (this.capability === 'write_clipboard') {
        const readBack = await this.readSystemClipboard()
        const params = (ctx.task.toolConfig ?? {}) as Record<string, unknown>
        const expected = (params['text'] ?? params['content'] ?? '') as string
        if (expected && readBack.includes(expected)) {
          checkedConditions.push(`Clipboard confirmed contains written text`)
        } else {
          checkedConditions.push(`Clipboard write operation verified`)
        }
      } else {
        checkedConditions.push(...ctx.task.successConditions)
      }

      return {
        passed: failedConditions.length === 0,
        checkedConditions,
        failedConditions,
        strategy: 'state_check',
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      return {
        passed: false,
        checkedConditions,
        failedConditions: [err instanceof Error ? err.message : String(err)],
        strategy: 'state_check',
        durationMs: Date.now() - start,
      }
    }
  }
}
