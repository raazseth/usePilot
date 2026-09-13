import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SafeBatchExecutor } from '../adapters/filesystem/batch-executor'
import { SafeFileOperations } from '../adapters/filesystem/file-operations'
import { WindowsPathNormalizer } from '../adapters/filesystem/windows-path'

describe('Messy Downloads Real-World Stress & Trust Receipt (Phase A Milestone)', () => {
  let testDir: string
  let downloadsDir: string
  let normalizer: WindowsPathNormalizer

  beforeEach(async () => {
    testDir = join(tmpdir(), `usepilot-messy-downloads-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    downloadsDir = join(testDir, 'Downloads')
    await fs.mkdir(downloadsDir, { recursive: true })
    normalizer = new WindowsPathNormalizer({ workingDirectory: downloadsDir })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it(
    'safely organizes 1,000 messy real-world files with collisions, locks, Unicode and outputs verified trust receipt',
    async () => {
    const extensions = ['pdf', 'docx', 'xlsx', 'txt', 'png', 'jpg', 'zip', 'tar.gz', 'ts', 'py', 'mp4', 'exe', '']
    const lockedFiles = new Set<string>()

    // 1. Generate 1,000 real messy files
    for (let i = 1; i <= 1000; i++) {
      const pad = String(i).padStart(4, '0')
      const ext = extensions[i % extensions.length]!

      let fileName: string
      if (i % 50 === 0) {
        // Unicode and emoji
        fileName = `📄 invoice_日本語_ñoño_${pad}.${ext || 'pdf'}`
      } else if (i % 40 === 0) {
        // Special characters: spaces, brackets, #, &
        fileName = `project report [final] & review #${i}.${ext || 'docx'}`
      } else if (ext === '') {
        fileName = `UNPACKAGED_BLOB_${pad}`
      } else {
        fileName = `file_${pad}.${ext}`
      }

      const filePath = join(downloadsDir, fileName)
      await fs.writeFile(filePath, `CONTENT_OF_FILE_${pad}_TIMESTAMP_${Date.now()}`, 'utf8')

      // Mark 3 specific files as locked by another process
      if (i === 123 || i === 456 || i === 789) {
        lockedFiles.add(normalizer.normalizePath(filePath))
      }
    }

    // Also pre-create 7 files in the destination Documents/Images folder to cause real collisions!
    const destBase = join(downloadsDir, 'Organized')
    await fs.mkdir(join(destBase, 'Documents'), { recursive: true })
    for (let c = 1; c <= 7; c++) {
      const collFile = join(destBase, 'Documents', `file_00${c * 13}.pdf`)
      await fs.writeFile(collFile, 'PRE_EXISTING_IMPORTANT_DOCUMENT', 'utf8')
    }

    // 2. Set up SafeFileOperations with locked-file simulator
    class WindowsLockAwareOperations extends SafeFileOperations {
      override async moveFile(rawSource: string, rawDest: string, opts?: any) {
        const normalizedSrc = normalizer.normalizePath(rawSource)
        if (lockedFiles.has(normalizedSrc)) {
          return {
            status: 'failed_locked' as const,
            sourcePath: normalizedSrc,
            destinationPath: normalizer.normalizePath(rawDest),
            verified: false,
            error: 'EBUSY: resource locked by another Windows process (ERROR_SHARING_VIOLATION 0x20)',
            resolvedDestination: normalizer.normalizePath(rawDest),
          }
        }
        return super.moveFile(rawSource, rawDest, opts)
      }
    }

    const lockAwareOps = new WindowsLockAwareOperations(normalizer)
    const executor = new SafeBatchExecutor({ normalizer, ops: lockAwareOps })

    // 3. Plan organization batch
    const planItems = await executor.planDirectoryOrganization(downloadsDir, {
      destinationDirectory: destBase,
      groupBy: 'category',
    })

    expect(planItems.length).toBe(1000)

    // 4. Execute safe batch
    const receipt = await executor.executeBatch(planItems, {
      mode: 'continue',
      collisionPolicy: 'rename_with_counter',
      computeHashes: true,
    })

    // 5. Generate human-readable receipt text
    const receiptText = receipt.formatReceipt()
    console.log('\n======================================================')
    console.log('USEPILOT FILESYSTEM EXECUTION TRUST RECEIPT')
    console.log('======================================================')
    console.log(receiptText)
    console.log('======================================================\n')

    // 6. Assertions on the receipt & verification guarantees
    expect(receipt.locked).toBe(3)
    expect(receipt.failed).toBe(0)
    expect(receipt.rolledBack).toBe(0)
    expect(receipt.organized).toBe(997) // 1000 - 3 locked = 997
    expect(receipt.conflicts).toBe(7) // 7 collisions safely handled by rename_with_counter
    expect(receipt.recoveryAvailable).toBe(true)

    // 7. Verify all 997 organized operations were cryptographically verified!
    expect(receipt.verification.total).toBe(997)
    expect(receipt.verification.verified).toBe(997)
    expect(receipt.verification.allMatched).toBe(true)

    // 8. Assert receipt text contains exact required format
    expect(receiptText).toContain('Organized: 997')
    expect(receiptText).toContain('Locked: 3')
    expect(receiptText).toContain('Conflicts: 7')
    expect(receiptText).toContain('Rolled back: 0')
    expect(receiptText).toContain('997/997 successful operations verified')
    expect(receiptText).toContain(`Execution ID: ${receipt.executionId}`)
    expect(receiptText).toContain('Recovery available: YES')

    // 9. PROVE: Zero pre-existing destination files were overwritten!
    for (let c = 1; c <= 7; c++) {
      const collFile = join(destBase, 'Documents', `file_00${c * 13}.pdf`)
      const content = await fs.readFile(collFile, 'utf8')
      expect(content).toBe('PRE_EXISTING_IMPORTANT_DOCUMENT')
    }
  }, 30000)
})
