import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, join } from 'node:path'
import type { Page, Download } from 'playwright'
import { SafeFileOperations, type CollisionPolicy } from '../filesystem/file-operations'
import { WindowsPathNormalizer } from '../filesystem/windows-path'

export interface DownloadResult {
  success: boolean
  suggestedFilename: string
  savedPath: string
  fileSize: number
  sha256: string
  verified: boolean
  error?: string | undefined
}

export interface CaptureDownloadOptions {
  triggerAction?: () => Promise<void>
  targetDirectory?: string | undefined
  customFilename?: string | undefined
  collisionPolicy?: CollisionPolicy | undefined
  timeoutMs?: number | undefined
}

export class DownloadManager {
  private readonly fileOps: SafeFileOperations
  private readonly normalizer: WindowsPathNormalizer

  constructor() {
    this.normalizer = new WindowsPathNormalizer()
    this.fileOps = new SafeFileOperations(this.normalizer)
  }

  /**
   * Traps a file download event triggered on a page:
   * 1. Sets up the download listener
   * 2. Executes the trigger action (e.g. clicking the download link/button)
   * 3. Awaits the Playwright download handshake
   * 4. Saves to destination directory (with collision safety)
   * 5. Computes SHA-256 hash and verifies non-empty size
   */
  async captureDownload(
    page: Page,
    options?: CaptureDownloadOptions | undefined
  ): Promise<DownloadResult> {
    const timeoutMs = options?.timeoutMs ?? 30000
    const targetDir = options?.targetDirectory
      ? this.normalizer.normalizePath(options.targetDirectory)
      : this.normalizer.normalizePath(join(process.cwd(), 'downloads'))

    await fs.mkdir(targetDir, { recursive: true })

    let download: Download
    try {
      if (options?.triggerAction) {
        const [capturedDownload] = await Promise.all([
          page.waitForEvent('download', { timeout: timeoutMs }),
          options.triggerAction(),
        ])
        download = capturedDownload
      } else {
        download = await page.waitForEvent('download', { timeout: timeoutMs })
      }
    } catch (err: unknown) {
      return {
        success: false,
        suggestedFilename: '',
        savedPath: '',
        fileSize: 0,
        sha256: '',
        verified: false,
        error: `Download failed or timed out after ${timeoutMs}ms: ${err instanceof Error ? err.message : String(err)}`,
      }
    }

    const rawFilename = options?.customFilename ?? download.suggestedFilename()
    const sanitizedFilename = WindowsPathNormalizer.sanitizeFilename(basename(rawFilename))

    const tempStagingPath = join(targetDir, `.tmp_download_${Date.now()}_${sanitizedFilename}`)
    try {
      await download.saveAs(tempStagingPath)
    } catch (saveErr: unknown) {
      await fs.unlink(tempStagingPath).catch(() => {})
      return {
        success: false,
        suggestedFilename: download.suggestedFilename(),
        savedPath: '',
        fileSize: 0,
        sha256: '',
        verified: false,
        error: `Failed saving download: ${saveErr instanceof Error ? saveErr.message : String(saveErr)}`,
      }
    }

    // Check size & compute hash
    const stats = await fs.stat(tempStagingPath)
    if (stats.size === 0) {
      await fs.unlink(tempStagingPath).catch(() => {})
      return {
        success: false,
        suggestedFilename: sanitizedFilename,
        savedPath: '',
        fileSize: 0,
        sha256: '',
        verified: false,
        error: 'Downloaded file is empty (0 bytes)',
      }
    }

    const data = await fs.readFile(tempStagingPath)
    const sha256 = createHash('sha256').update(data).digest('hex')

    // Move from temporary staging path to final destination using collision policy
    const policy = options?.collisionPolicy ?? 'rename_with_counter'
    const finalDestPath = join(targetDir, sanitizedFilename)

    const moveRes = await this.fileOps.moveFile(tempStagingPath, finalDestPath, {
      collisionPolicy: policy,
      computeHashes: true,
    })

    if (moveRes.status !== 'success') {
      await fs.unlink(tempStagingPath).catch(() => {})
      return {
        success: false,
        suggestedFilename: sanitizedFilename,
        savedPath: '',
        fileSize: stats.size,
        sha256,
        verified: false,
        error: `Failed relocating download to target: ${moveRes.error}`,
      }
    }

    return {
      success: true,
      suggestedFilename: sanitizedFilename,
      savedPath: moveRes.resolvedDestination,
      fileSize: stats.size,
      sha256,
      verified: moveRes.verified,
    }
  }
}
