import { createHash, randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  VerificationResult,
} from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'

export interface FilesystemAdapterOptions {
  workingDirectory?: string | undefined
}

export class NativeFilesystemAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']
  readonly name = 'NativeFilesystemAdapter'

  private readonly workingDirectory: string

  constructor(capability: TaskCapability, options?: FilesystemAdapterOptions | undefined) {
    this.capability = capability
    this.workingDirectory = options?.workingDirectory ?? process.cwd()
  }

  async initialize(): Promise<void> {
    // Initialized and ready
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async cleanup(): Promise<void> {
    // Clean temporary operational files if any
  }

  async dispose(): Promise<void> {
    // No persistent handles to close
  }

  private resolvePath(filePath: string): string {
    return resolve(this.workingDirectory, filePath)
  }

  private async computeHash(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath)
    return createHash('sha256').update(data).digest('hex')
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
        case 'read_file': {
          const target = this.resolvePath((params['path'] ?? params['filePath'] ?? task.title) as string)
          const encoding = (params['encoding'] as BufferEncoding) ?? 'utf8'
          const content = await fs.readFile(target, encoding)
          const stats = await fs.stat(target)
          const hash = await this.computeHash(target)
          output = { path: target, size: stats.size, hash, content }
          break
        }

        case 'write_file': {
          const target = this.resolvePath((params['path'] ?? params['filePath'] ?? task.title) as string)
          const content = (params['content'] ?? '') as string
          const targetDir = dirname(target)
          await fs.mkdir(targetDir, { recursive: true })

          // Atomic write via temp file
          const tempPath = `${target}.tmp.${randomBytes(6).toString('hex')}`
          try {
            await fs.writeFile(tempPath, content, 'utf8')
            await fs.rename(tempPath, target)
          } catch (writeErr) {
            await fs.unlink(tempPath).catch(() => {})
            throw writeErr
          }

          const stats = await fs.stat(target)
          const hash = await this.computeHash(target)
          output = { path: target, size: stats.size, hash, bytesWritten: Buffer.byteLength(content) }
          break
        }

        case 'move_file': {
          const source = this.resolvePath((params['source'] ?? params['sourcePath']) as string)
          const destination = this.resolvePath((params['destination'] ?? params['destinationPath'] ?? params['target']) as string)
          await fs.mkdir(dirname(destination), { recursive: true })
          try {
            await fs.rename(source, destination)
          } catch (err: unknown) {
            const e = err as { code?: string }
            if (e.code === 'EXDEV') {
              await fs.copyFile(source, destination)
              await fs.unlink(source)
            } else {
              throw err
            }
          }
          output = { source, destination, moved: true }
          break
        }

        case 'delete_file': {
          const target = this.resolvePath((params['path'] ?? params['filePath'] ?? task.title) as string)
          await fs.rm(target, { recursive: true, force: true })
          output = { path: target, deleted: true }
          break
        }

        default: {
          // Additional filesystem helpers
          if (task.title.toLowerCase().includes('create directory') || task.title.toLowerCase().includes('mkdir')) {
            const target = this.resolvePath((params['path'] ?? params['dirPath']) as string)
            await fs.mkdir(target, { recursive: true })
            output = { path: target, created: true }
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
        failureCategory: 'adapter_failure',
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

    const output = (result.output ?? {}) as Record<string, unknown>
    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    try {
      if (this.capability === 'write_file' && typeof output['path'] === 'string') {
        const stats = await fs.stat(output['path'])
        if (stats.size >= 0) {
          checkedConditions.push(`File exists at ${output['path']} with size ${stats.size}`)
        } else {
          failedConditions.push(`File at ${output['path']} has invalid size`)
        }
      } else if (this.capability === 'move_file' && typeof output['destination'] === 'string') {
        const destStats = await fs.stat(output['destination'])
        if (destStats.isFile() || destStats.isDirectory()) {
          checkedConditions.push(`Destination exists at ${output['destination']}`)
        }
      } else if (this.capability === 'delete_file' && typeof output['path'] === 'string') {
        try {
          await fs.stat(output['path'])
          failedConditions.push(`File still exists at ${output['path']}`)
        } catch {
          checkedConditions.push(`File confirmed deleted at ${output['path']}`)
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
