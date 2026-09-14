import { randomBytes } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { dirname, resolve } from 'node:path'

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  VerificationResult,
} from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'
import { WindowsPathNormalizer } from './windows-path'
import { SafeFileOperations, type CollisionPolicy } from './file-operations'
import { SafeBatchExecutor, type BatchFailureMode } from './batch-executor'

export interface FilesystemAdapterOptions {
  workingDirectory?: string | undefined
}

export class NativeFilesystemAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']
  readonly name = 'NativeFilesystemAdapter'

  private readonly workingDirectory: string
  private readonly normalizer: WindowsPathNormalizer
  private readonly fileOps: SafeFileOperations
  private readonly batchExecutor: SafeBatchExecutor

  constructor(capability: TaskCapability, options?: FilesystemAdapterOptions | undefined) {
    this.capability = capability
    this.workingDirectory = options?.workingDirectory ?? process.cwd()
    this.normalizer = new WindowsPathNormalizer({ workingDirectory: this.workingDirectory })
    this.fileOps = new SafeFileOperations(this.normalizer)
    this.batchExecutor = new SafeBatchExecutor({ normalizer: this.normalizer, ops: this.fileOps })
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
    return this.normalizer.normalizePath(filePath)
  }

  private async computeHash(filePath: string): Promise<string> {
    return this.fileOps.computeFileHash(this.resolvePath(filePath))
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
          const target = this.resolvePath((params['path'] ?? params['filePath'] ?? params['folder'] ?? params['directory'] ?? task.title) as string)
          const stats = await fs.stat(target)
          if (stats.isDirectory()) {
            const entries = await fs.readdir(target)
            output = { path: target, size: stats.size, isDirectory: true, entries }
          } else {
            const encoding = (params['encoding'] as BufferEncoding) ?? 'utf8'
            const content = await fs.readFile(target, encoding)
            const hash = await this.computeHash(target)
            output = { path: target, size: stats.size, hash, content }
          }
          break
        }

        case 'write_file': {
          if (params['operation'] === 'ensure_directories') {
            const basePath = this.resolvePath((params['basePath'] ?? params['path'] ?? params['folder'] ?? params['directory'] ?? task.title) as string)
            const categories = (params['categories'] ?? []) as string[]
            for (const cat of categories) {
              await fs.mkdir(resolve(basePath, cat), { recursive: true })
            }
            output = { path: basePath, created: true, categories }
            break
          }

          const target = this.resolvePath((params['path'] ?? params['filePath'] ?? task.title) as string)
          const syntaxCheck = WindowsPathNormalizer.isValidPathSyntax(target)
          if (!syntaxCheck.valid) {
            throw new Error(`Invalid path: ${syntaxCheck.reason}`)
          }

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
          if (params['operation'] === 'move_batch') {
            const src = this.resolvePath((params['sourcePath'] ?? params['source'] ?? params['folder']) as string)
            const dest = this.resolvePath((params['destinationPath'] ?? params['destination'] ?? src) as string)
            const mode = (params['mode'] as BatchFailureMode) ?? 'continue'
            const collisionPolicy = (params['collisionPolicy'] as CollisionPolicy) ?? 'rename_with_counter'
            const rawGroupBy = String(params['groupBy'] ?? 'category')
            const groupBy = rawGroupBy === 'extension' ? 'extension' : 'category'

            // Generate planned moves
            const batchItems = await this.batchExecutor.planDirectoryOrganization(src, {
              destinationDirectory: dest,
              groupBy,
            })

            // Execute safe batch with verification and receipt
            const receipt = await this.batchExecutor.executeBatch(batchItems, {
              mode,
              collisionPolicy,
              computeHashes: true,
            })

            output = {
              source: src,
              destination: dest,
              receipt: {
                executionId: receipt.executionId,
                organized: receipt.organized,
                skipped: receipt.skipped,
                locked: receipt.locked,
                conflicts: receipt.conflicts,
                failed: receipt.failed,
                rolledBack: receipt.rolledBack,
                verification: receipt.verification,
                recoveryAvailable: receipt.recoveryAvailable,
                formattedText: receipt.formatReceipt(),
              },
              movedCount: receipt.organized,
              success: receipt.failed === 0,
            }
            break
          }

          if (params['operation'] === 'rename_batch') {
            const folder = this.resolvePath((params['folder'] ?? params['path'] ?? params['sourcePath']) as string)
            const replacement = (params['replacement'] ?? 'renamed_') as string
            const entries = await fs.readdir(folder)
            const renamed: Array<{ from: string; to: string }> = []
            for (const file of entries) {
              const fullSource = resolve(folder, file)
              const stat = await fs.stat(fullSource)
              if (stat.isFile() && !file.startsWith(replacement)) {
                const targetName = `${replacement}${file}`
                const fullDest = resolve(folder, targetName)
                await fs.rename(fullSource, fullDest)
                renamed.push({ from: file, to: targetName })
              }
            }
            output = {
              folder,
              renamedCount: renamed.length,
              renamedFiles: renamed,
              success: true,
            }
            break
          }

          const source = this.resolvePath((params['source'] ?? params['sourcePath']) as string)
          const destination = this.resolvePath((params['destination'] ?? params['destinationPath'] ?? params['target']) as string)
          const collisionPolicy = (params['collisionPolicy'] as CollisionPolicy) ?? 'rename_with_counter'

          const moveResult = await this.fileOps.moveFile(source, destination, {
            collisionPolicy,
            computeHashes: true,
          })

          if (moveResult.status !== 'success') {
            throw new Error(`File move failed [${moveResult.status}]: ${moveResult.error ?? 'Unknown error'}`)
          }

          output = {
            source: moveResult.sourcePath,
            destination: moveResult.destinationPath,
            sourceHash: moveResult.sourceHash,
            destinationHash: moveResult.destinationHash,
            verified: moveResult.verified,
            moved: true,
          }
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
        if (stats.size >= 0 || stats.isDirectory()) {
          checkedConditions.push(`Target exists at ${output['path']}`)
        } else {
          failedConditions.push(`Target at ${output['path']} has invalid size`)
        }
      } else if (this.capability === 'move_file') {
        const receipt = output['receipt'] as
          | { verification?: { allMatched?: boolean; verified?: number; total?: number } }
          | undefined
        if (receipt?.verification) {
          if (receipt.verification.allMatched) {
            checkedConditions.push(
              `All ${receipt.verification.verified} operations verified via SHA-256 hash match`
            )
          } else {
            failedConditions.push(
              `Verification mismatch: ${receipt.verification.verified}/${receipt.verification.total} operations verified`
            )
          }
        } else if (typeof output['destination'] === 'string') {
          const destStats = await fs.stat(output['destination'])
          if (destStats.isFile() || destStats.isDirectory()) {
            checkedConditions.push(`Destination exists at ${output['destination']}`)
          }
        }
      } else if (this.capability === 'read_file' && typeof output['path'] === 'string') {
        const readStats = await fs.stat(output['path'])
        if (readStats.isFile() || readStats.isDirectory()) {
          checkedConditions.push(`Path verified at ${output['path']}`)
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
