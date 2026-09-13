import { generateId } from '@usepilot/utils'
import { promises as fs } from 'node:fs'
import { extname, join, resolve } from 'node:path'
import {
  type CollisionPolicy,
  type MoveFileResult,
  type OperationStatus,
  SafeFileOperations,
} from './file-operations'
import { WindowsPathNormalizer } from './windows-path'

export type BatchFailureMode = 'rollback' | 'continue'

export interface BatchItemSpec {
  sourcePath: string
  destinationPath: string
}

export interface BatchItemExecutionRecord {
  id: string
  sourcePath: string
  destinationPath: string
  resolvedDestination: string
  status: OperationStatus
  sourceHash?: string | undefined
  destinationHash?: string | undefined
  verified: boolean
  error?: string | undefined
  timestamp: number
  isConflict: boolean
}

export interface FilesystemReceipt {
  executionId: string
  mode: BatchFailureMode
  collisionPolicy: CollisionPolicy
  organized: number
  skipped: number
  locked: number
  conflicts: number
  failed: number
  rolledBack: number
  verification: {
    total: number
    verified: number
    allMatched: boolean
  }
  recoveryAvailable: boolean
  durationMs: number
  records: BatchItemExecutionRecord[]
  formatReceipt(): string
}

export interface BatchExecutorOptions {
  mode?: BatchFailureMode | undefined
  collisionPolicy?: CollisionPolicy | undefined
  computeHashes?: boolean | undefined
  normalizer?: WindowsPathNormalizer | undefined
}

export class SafeBatchExecutor {
  private readonly ops: SafeFileOperations
  private readonly normalizer: WindowsPathNormalizer

  constructor(options?: { ops?: SafeFileOperations; normalizer?: WindowsPathNormalizer }) {
    this.normalizer = options?.normalizer ?? new WindowsPathNormalizer()
    this.ops = options?.ops ?? new SafeFileOperations(this.normalizer)
  }

  /**
   * Generates formatted human-readable receipt text.
   */
  static formatReceiptText(receipt: Omit<FilesystemReceipt, 'formatReceipt'>): string {
    return [
      `Organized: ${receipt.organized}`,
      `Skipped: ${receipt.skipped}`,
      `Locked: ${receipt.locked}`,
      `Conflicts: ${receipt.conflicts}`,
      `Failed: ${receipt.failed}`,
      `Rolled back: ${receipt.rolledBack}`,
      '',
      'Verification:',
      `${receipt.verification.verified}/${receipt.verification.total} successful operations verified`,
      '',
      `Execution ID: ${receipt.executionId}`,
      `Recovery available: ${receipt.recoveryAvailable ? 'YES' : 'NO'}`,
    ].join('\n')
  }

  /**
   * Rolls back a list of completed operations by moving files from their
   * resolvedDestination back to their original sourcePath and verifying hashes.
   */
  async rollbackCompletedOperations(
    completedRecords: BatchItemExecutionRecord[]
  ): Promise<{ restoredCount: number; failedRollbacks: number }> {
    let restoredCount = 0
    let failedRollbacks = 0

    // Rollback in reverse order
    const toUndo = [...completedRecords].reverse()
    for (const record of toUndo) {
      if (record.status !== 'success') continue

      try {
        const dest = record.resolvedDestination
        const origSrc = record.sourcePath

        // Move back to original source
        await fs.mkdir(resolve(origSrc, '..'), { recursive: true })
        await fs.rename(dest, origSrc)

        // Verify hash
        if (record.sourceHash) {
          const restoredHash = await this.ops.computeFileHash(origSrc)
          if (restoredHash === record.sourceHash) {
            record.status = 'rolled_back'
            restoredCount++
          } else {
            failedRollbacks++
          }
        } else {
          record.status = 'rolled_back'
          restoredCount++
        }
      } catch {
        failedRollbacks++
      }
    }

    return { restoredCount, failedRollbacks }
  }

  /**
   * Executes a batch of file move specifications with:
   * - Rollback Mode or Continue/Skip Mode
   * - Collision safety (no silent overwrites)
   * - Verification of every successful operation
   * - Production of full FilesystemReceipt
   */
  async executeBatch(
    items: BatchItemSpec[],
    options?: BatchExecutorOptions
  ): Promise<FilesystemReceipt> {
    const start = Date.now()
    const executionId = `fs-run-${generateId().slice(0, 8)}`
    const mode = options?.mode ?? 'continue'
    const collisionPolicy = options?.collisionPolicy ?? 'rename_with_counter'
    const computeHashes = options?.computeHashes ?? true

    const records: BatchItemExecutionRecord[] = []
    let organized = 0
    let skipped = 0
    let locked = 0
    let conflicts = 0
    let failed = 0
    let rolledBack = 0

    const succeededRecords: BatchItemExecutionRecord[] = []

    for (const item of items) {
      const res: MoveFileResult = await this.ops.moveFile(item.sourcePath, item.destinationPath, {
        collisionPolicy,
        computeHashes,
      })

      const isConflict = res.resolvedDestination !== this.normalizer.normalizePath(item.destinationPath)
      if (isConflict) {
        conflicts++
      }

      const record: BatchItemExecutionRecord = {
        id: generateId(),
        sourcePath: res.sourcePath,
        destinationPath: res.destinationPath,
        resolvedDestination: res.resolvedDestination,
        status: res.status,
        sourceHash: res.sourceHash,
        destinationHash: res.destinationHash,
        verified: res.verified,
        error: res.error,
        timestamp: Date.now(),
        isConflict,
      }
      records.push(record)

      if (res.status === 'success') {
        organized++
        succeededRecords.push(record)
      } else if (res.status === 'skipped_conflict') {
        skipped++
      } else if (res.status === 'failed_locked') {
        locked++
        if (mode === 'rollback') {
          // Trigger atomic rollback of all previous succeeded operations!
          const rollbackRes = await this.rollbackCompletedOperations(succeededRecords)
          rolledBack = rollbackRes.restoredCount
          organized = organized - rolledBack
          failed++
          break
        }
      } else {
        failed++
        if (mode === 'rollback') {
          const rollbackRes = await this.rollbackCompletedOperations(succeededRecords)
          rolledBack = rollbackRes.restoredCount
          organized = organized - rolledBack
          break
        }
      }
    }

    const verifiedCount = records.filter((r) => r.status === 'success' && r.verified).length
    const totalSuccessful = organized

    const receiptData: Omit<FilesystemReceipt, 'formatReceipt'> = {
      executionId,
      mode,
      collisionPolicy,
      organized,
      skipped,
      locked,
      conflicts,
      failed,
      rolledBack,
      verification: {
        total: totalSuccessful,
        verified: verifiedCount,
        allMatched: totalSuccessful === verifiedCount,
      },
      recoveryAvailable: succeededRecords.length > 0 && mode === 'continue',
      durationMs: Date.now() - start,
      records,
    }

    return {
      ...receiptData,
      formatReceipt: () => SafeBatchExecutor.formatReceiptText(receiptData),
    }
  }

  /**
   * Helper to build batch move items for organizing a directory by file extension or categories.
   */
  static categorizeFile(fileName: string): string {
    const ext = extname(fileName).toLowerCase().slice(1)
    if (!ext) return 'Other'

    const docExtensions = new Set(['pdf', 'doc', 'docx', 'txt', 'rtf', 'xlsx', 'xls', 'pptx', 'csv', 'md'])
    const imgExtensions = new Set(['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp', 'ico'])
    const archiveExtensions = new Set(['zip', 'tar', 'gz', 'rar', '7z', 'bz2', 'iso'])
    const mediaExtensions = new Set(['mp3', 'wav', 'mp4', 'mov', 'avi', 'mkv', 'flac'])
    const codeExtensions = new Set(['ts', 'js', 'json', 'py', 'html', 'css', 'go', 'rs', 'c', 'cpp'])
    const appExtensions = new Set(['exe', 'msi', 'dmg', 'pkg', 'deb', 'appimage'])

    if (docExtensions.has(ext)) return 'Documents'
    if (imgExtensions.has(ext)) return 'Images'
    if (archiveExtensions.has(ext)) return 'Archives'
    if (mediaExtensions.has(ext)) return 'Media'
    if (codeExtensions.has(ext)) return 'Code'
    if (appExtensions.has(ext)) return 'Applications'

    return `${ext.toUpperCase()}s`
  }

  /**
   * Scans a messy directory and generates organization batch items.
   */
  async planDirectoryOrganization(
    directoryPath: string,
    options?: { destinationDirectory?: string; groupBy?: 'category' | 'extension' }
  ): Promise<BatchItemSpec[]> {
    const normalizedSrc = this.normalizer.normalizePath(directoryPath)
    const normalizedDest = options?.destinationDirectory
      ? this.normalizer.normalizePath(options.destinationDirectory)
      : normalizedSrc

    const groupBy = options?.groupBy ?? 'category'
    const entries = await fs.readdir(normalizedSrc, { withFileTypes: true })
    const items: BatchItemSpec[] = []

    for (const entry of entries) {
      // Only organize files directly in the root directory, not existing subdirectories
      if (!entry.isFile()) continue

      const subfolder =
        groupBy === 'category'
          ? SafeBatchExecutor.categorizeFile(entry.name)
          : (extname(entry.name).toLowerCase().slice(1) || 'other').toUpperCase() + 's'

      items.push({
        sourcePath: join(normalizedSrc, entry.name),
        destinationPath: join(normalizedDest, subfolder, entry.name),
      })
    }

    return items
  }
}
