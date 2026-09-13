import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SafeBatchExecutor, type BatchItemSpec } from '../adapters/filesystem/batch-executor'
import { SafeFileOperations } from '../adapters/filesystem/file-operations'
import { WindowsPathNormalizer } from '../adapters/filesystem/windows-path'

describe('Partial Failure, Rollback & Verification (P0)', () => {
  let testDir: string
  let srcDir: string
  let destDir: string
  let normalizer: WindowsPathNormalizer

  beforeEach(async () => {
    testDir = join(tmpdir(), `usepilot-fs-partial-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    srcDir = join(testDir, 'Downloads')
    destDir = join(testDir, 'Organized')
    await fs.mkdir(srcDir, { recursive: true })
    await fs.mkdir(destDir, { recursive: true })
    normalizer = new WindowsPathNormalizer({ workingDirectory: testDir })
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('proves 100-file partial failure in ROLLBACK MODE: files 1-43 restored with matching hashes', async () => {
    // 1. Create 100 source files with unique content
    const items: BatchItemSpec[] = []
    const initialHashes = new Map<string, string>()

    for (let i = 1; i <= 100; i++) {
      const pad = String(i).padStart(3, '0')
      const fileName = `file-${pad}.txt`
      const filePath = join(srcDir, fileName)
      const content = `DATA_PAYLOAD_FILE_${pad}_TIMESTAMP_${Date.now()}`
      await fs.writeFile(filePath, content, 'utf8')

      const ops = new SafeFileOperations(normalizer)
      const hash = await ops.computeFileHash(filePath)
      initialHashes.set(filePath, hash)

      items.push({
        sourcePath: filePath,
        destinationPath: join(destDir, 'TextFiles', fileName),
      })
    }

    // 2. Inject failure/lock on file 44
    const lockedSrcPath = items[43]!.sourcePath // 0-indexed 43 is file 44

    class LockedFileMockOperations extends SafeFileOperations {
      override async moveFile(rawSource: string, rawDest: string, opts?: any) {
        const normalized = normalizer.normalizePath(rawSource)
        if (normalized === normalizer.normalizePath(lockedSrcPath)) {
          return {
            status: 'failed_locked' as const,
            sourcePath: normalized,
            destinationPath: normalizer.normalizePath(rawDest),
            verified: false,
            error: 'EBUSY: resource busy or locked by another Windows process (ERROR_SHARING_VIOLATION 0x20)',
            resolvedDestination: normalizer.normalizePath(rawDest),
          }
        }
        return super.moveFile(rawSource, rawDest, opts)
      }
    }

    const lockedOps = new LockedFileMockOperations(normalizer)
    const executor = new SafeBatchExecutor({ normalizer, ops: lockedOps })

    // 3. Execute in ROLLBACK mode
    const receipt = await executor.executeBatch(items, {
      mode: 'rollback',
      collisionPolicy: 'rename_with_counter',
      computeHashes: true,
    })

    // 4. Validate receipt
    expect(receipt.mode).toBe('rollback')
    expect(receipt.locked).toBe(1)
    expect(receipt.rolledBack).toBe(43)
    expect(receipt.organized).toBe(0)

    // 5. PROVE RECOVERY: Files 1 to 43 were restored to their exact original source paths
    for (let i = 1; i <= 43; i++) {
      const pad = String(i).padStart(3, '0')
      const originalPath = join(srcDir, `file-${pad}.txt`)
      const exists = await lockedOps.pathExists(originalPath)
      expect(exists).toBe(true)

      // Verify restored hash matches original pre-batch hash!
      const restoredHash = await lockedOps.computeFileHash(originalPath)
      expect(restoredHash).toBe(initialHashes.get(originalPath))
    }

    // Locked file 44 also remains in source
    expect(await lockedOps.pathExists(lockedSrcPath)).toBe(true)

    // Destination directory TextFiles should be completely empty
    const destEntries = await fs.readdir(join(destDir, 'TextFiles')).catch(() => [])
    expect(destEntries.length).toBe(0)
  }, 20000)

  it('proves 100-file partial failure in CONTINUE/SKIP MODE: 99 succeed, 1 locked, all 99 verified', async () => {
    // 1. Create 100 source files
    const items: BatchItemSpec[] = []
    const initialHashes = new Map<string, string>()

    for (let i = 1; i <= 100; i++) {
      const pad = String(i).padStart(3, '0')
      const fileName = `doc-${pad}.pdf`
      const filePath = join(srcDir, fileName)
      const content = `PDF_STREAM_CONTENT_${pad}`
      await fs.writeFile(filePath, content, 'utf8')

      const ops = new SafeFileOperations(normalizer)
      const hash = await ops.computeFileHash(filePath)
      initialHashes.set(filePath, hash)

      items.push({
        sourcePath: filePath,
        destinationPath: join(destDir, 'Documents', fileName),
      })
    }

    // 2. Inject lock on file 44
    const lockedSrcPath = items[43]!.sourcePath

    class LockedFileMockOperations extends SafeFileOperations {
      override async moveFile(rawSource: string, rawDest: string, opts?: any) {
        const normalized = normalizer.normalizePath(rawSource)
        if (normalized === normalizer.normalizePath(lockedSrcPath)) {
          return {
            status: 'failed_locked' as const,
            sourcePath: normalized,
            destinationPath: normalizer.normalizePath(rawDest),
            verified: false,
            error: 'EBUSY: process lock',
            resolvedDestination: normalizer.normalizePath(rawDest),
          }
        }
        return super.moveFile(rawSource, rawDest, opts)
      }
    }

    const lockedOps = new LockedFileMockOperations(normalizer)
    const executor = new SafeBatchExecutor({ normalizer, ops: lockedOps })

    // 3. Execute in CONTINUE mode
    const receipt = await executor.executeBatch(items, {
      mode: 'continue',
      collisionPolicy: 'rename_with_counter',
      computeHashes: true,
    })

    // 4. Validate receipt
    expect(receipt.mode).toBe('continue')
    expect(receipt.organized).toBe(99)
    expect(receipt.locked).toBe(1)
    expect(receipt.rolledBack).toBe(0)
    expect(receipt.verification.total).toBe(99)
    expect(receipt.verification.verified).toBe(99)
    expect(receipt.verification.allMatched).toBe(true)

    // 5. Verify that file 44 remained intact in source directory
    expect(await lockedOps.pathExists(lockedSrcPath)).toBe(true)

    // 6. Verify that files 1-43 and 45-100 moved to destination with exact hashes
    for (let i = 1; i <= 100; i++) {
      if (i === 44) continue
      const pad = String(i).padStart(3, '0')
      const destPath = join(destDir, 'Documents', `doc-${pad}.pdf`)
      const exists = await lockedOps.pathExists(destPath)
      expect(exists).toBe(true)

      const destHash = await lockedOps.computeFileHash(destPath)
      const origSrc = join(srcDir, `doc-${pad}.pdf`)
      expect(destHash).toBe(initialHashes.get(origSrc))
    }
  }, 20000)
})
