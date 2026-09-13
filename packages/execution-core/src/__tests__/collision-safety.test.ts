import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { SafeFileOperations } from '../adapters/filesystem/file-operations'
import { WindowsPathNormalizer } from '../adapters/filesystem/windows-path'

describe('Collision Safety & Zero Silent Overwrites (P0)', () => {
  let testDir: string
  let normalizer: WindowsPathNormalizer
  let fileOps: SafeFileOperations

  beforeEach(async () => {
    testDir = join(tmpdir(), `usepilot-fs-collision-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
    await fs.mkdir(testDir, { recursive: true })
    normalizer = new WindowsPathNormalizer({ workingDirectory: testDir })
    fileOps = new SafeFileOperations(normalizer)
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true }).catch(() => {})
  })

  it('PROVE: never silently overwrites an existing file under rename_with_counter', async () => {
    const src = join(testDir, 'invoice.pdf')
    const destDir = join(testDir, 'Documents')
    const dest = join(destDir, 'invoice.pdf')

    await fs.mkdir(destDir, { recursive: true })
    await fs.writeFile(src, 'SOURCE_CONTENT_V2', 'utf8')
    await fs.writeFile(dest, 'EXISTING_CRITICAL_CONTENT_V1', 'utf8')

    const srcHash = await fileOps.computeFileHash(src)
    const originalDestHash = await fileOps.computeFileHash(dest)

    // Execute move
    const result = await fileOps.moveFile(src, dest, { collisionPolicy: 'rename_with_counter' })

    expect(result.status).toBe('success')
    expect(result.resolvedDestination).toContain('invoice (1).pdf')

    // Verify existing file was NOT overwritten!
    const existingContent = await fs.readFile(dest, 'utf8')
    expect(existingContent).toBe('EXISTING_CRITICAL_CONTENT_V1')
    const destHashAfter = await fileOps.computeFileHash(dest)
    expect(destHashAfter).toBe(originalDestHash)

    // Verify renamed file has exact source content and hash
    const movedContent = await fs.readFile(result.resolvedDestination, 'utf8')
    expect(movedContent).toBe('SOURCE_CONTENT_V2')
    const movedHash = await fileOps.computeFileHash(result.resolvedDestination)
    expect(movedHash).toBe(srcHash)
  })

  it('increments counter sequentially when multiple collisions exist (e.g. invoice (1).pdf, (2).pdf)', async () => {
    const destDir = join(testDir, 'Documents')
    await fs.mkdir(destDir, { recursive: true })

    const dest = join(destDir, 'data.csv')
    const dest1 = join(destDir, 'data (1).csv')
    await fs.writeFile(dest, 'ORIGINAL', 'utf8')
    await fs.writeFile(dest1, 'COPY_1', 'utf8')

    const src = join(testDir, 'data.csv')
    await fs.writeFile(src, 'NEW_DATA', 'utf8')

    const result = await fileOps.moveFile(src, dest, { collisionPolicy: 'rename_with_counter' })

    expect(result.status).toBe('success')
    expect(result.resolvedDestination).toContain('data (2).csv')
    expect(await fs.readFile(result.resolvedDestination, 'utf8')).toBe('NEW_DATA')
    expect(await fs.readFile(dest, 'utf8')).toBe('ORIGINAL')
    expect(await fs.readFile(dest1, 'utf8')).toBe('COPY_1')
  })

  it('PROVE: policy "skip" preserves both source and destination without modification', async () => {
    const src = join(testDir, 'photo.jpg')
    const dest = join(testDir, 'Images', 'photo.jpg')

    await fs.mkdir(join(testDir, 'Images'), { recursive: true })
    await fs.writeFile(src, 'NEW_PHOTO_SOURCE', 'utf8')
    await fs.writeFile(dest, 'OLD_PHOTO_DESTINATION', 'utf8')

    const result = await fileOps.moveFile(src, dest, { collisionPolicy: 'skip' })

    expect(result.status).toBe('skipped_conflict')
    expect(await fs.readFile(dest, 'utf8')).toBe('OLD_PHOTO_DESTINATION')
    expect(await fs.readFile(src, 'utf8')).toBe('NEW_PHOTO_SOURCE')
  })

  it('PROVE: policy "fail_fast" aborts without touching existing files', async () => {
    const src = join(testDir, 'budget.xlsx')
    const dest = join(testDir, 'Finance', 'budget.xlsx')

    await fs.mkdir(join(testDir, 'Finance'), { recursive: true })
    await fs.writeFile(src, 'NEW_BUDGET', 'utf8')
    await fs.writeFile(dest, 'EXISTING_BUDGET', 'utf8')

    const result = await fileOps.moveFile(src, dest, { collisionPolicy: 'fail_fast' })

    expect(result.status).toBe('failed_error')
    expect(result.error).toContain("policy is 'fail_fast'")
    expect(await fs.readFile(dest, 'utf8')).toBe('EXISTING_BUDGET')
    expect(await fs.readFile(src, 'utf8')).toBe('NEW_BUDGET')
  })
})
