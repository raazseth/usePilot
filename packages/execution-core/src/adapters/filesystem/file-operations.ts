import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'
import { basename, dirname, extname, join } from 'node:path'
import { WindowsPathNormalizer } from './windows-path'

export type CollisionPolicy = 'rename_with_counter' | 'skip' | 'fail_fast'

export type OperationStatus =
  | 'success'
  | 'skipped_conflict'
  | 'skipped_locked'
  | 'failed_permission'
  | 'failed_locked'
  | 'failed_not_found'
  | 'failed_error'
  | 'rolled_back'

export interface OperationLogEntry {
  id: string
  operation: 'move' | 'copy' | 'delete' | 'write'
  sourcePath: string
  destinationPath?: string | undefined
  sourceHash?: string | undefined
  destinationHash?: string | undefined
  status: OperationStatus
  errorMessage?: string | undefined
  timestamp: number
  verified: boolean
}

export interface MoveFileOptions {
  collisionPolicy?: CollisionPolicy | undefined
  computeHashes?: boolean | undefined
  normalizer?: WindowsPathNormalizer | undefined
}

export interface MoveFileResult {
  status: OperationStatus
  sourcePath: string
  destinationPath: string
  sourceHash?: string | undefined
  destinationHash?: string | undefined
  verified: boolean
  error?: string | undefined
  resolvedDestination: string
}

export class SafeFileOperations {
  private readonly normalizer: WindowsPathNormalizer

  constructor(normalizer?: WindowsPathNormalizer) {
    this.normalizer = normalizer ?? new WindowsPathNormalizer()
  }

  /**
   * Computes SHA-256 hash of a file.
   */
  async computeFileHash(filePath: string): Promise<string> {
    const data = await fs.readFile(filePath)
    return createHash('sha256').update(data).digest('hex')
  }

  /**
   * Checks whether a file exists without throwing on ENOENT.
   */
  async pathExists(targetPath: string): Promise<boolean> {
    try {
      await fs.stat(targetPath)
      return true
    } catch {
      return false
    }
  }

  /**
   * Categorizes OS error into specific Windows / POSIX failure category:
   * Detects sharing violations, process locks, permission errors, etc.
   */
  classifyFsError(err: unknown): {
    category: 'locked' | 'permission' | 'not_found' | 'cross_device' | 'already_exists' | 'other'
    message: string
  } {
    const message = err instanceof Error ? err.message : String(err)
    const code = (err as { code?: string })?.code

    // Windows sharing violation / process locks:
    // EBUSY, or EPERM with sharing violation or Windows code 32 (0x20)
    if (
      code === 'EBUSY' ||
      code === 'ETXTBSY' ||
      message.includes('EBUSY') ||
      message.includes('sharing violation') ||
      message.includes('used by another process') ||
      message.includes('ERROR_SHARING_VIOLATION') ||
      message.includes('0x20')
    ) {
      return { category: 'locked', message }
    }

    // Windows permission issues: EACCES or general EPERM
    if (code === 'EACCES' || (code === 'EPERM' && !message.includes('sharing violation'))) {
      return { category: 'permission', message }
    }

    if (code === 'ENOENT') {
      return { category: 'not_found', message }
    }

    if (code === 'EXDEV') {
      return { category: 'cross_device', message }
    }

    if (code === 'EEXIST') {
      return { category: 'already_exists', message }
    }

    return { category: 'other', message }
  }

  /**
   * Resolves collision for destination path based on policy.
   * NEVER silently overwrites!
   */
  async resolveDestinationConflict(
    targetPath: string,
    policy: CollisionPolicy
  ): Promise<{ resolvedPath: string; isConflict: boolean; shouldSkip: boolean }> {
    const exists = await this.pathExists(targetPath)
    if (!exists) {
      return { resolvedPath: targetPath, isConflict: false, shouldSkip: false }
    }

    // Conflict exists!
    if (policy === 'fail_fast') {
      throw new Error(`Destination file already exists and policy is 'fail_fast': ${targetPath}`)
    }

    if (policy === 'skip') {
      return { resolvedPath: targetPath, isConflict: true, shouldSkip: true }
    }

    // policy === 'rename_with_counter'
    const dir = dirname(targetPath)
    const ext = extname(targetPath)
    const nameWithoutExt = basename(targetPath, ext)

    let counter = 1
    let candidatePath = join(dir, `${nameWithoutExt} (${counter})${ext}`)
    while (await this.pathExists(candidatePath)) {
      counter++
      candidatePath = join(dir, `${nameWithoutExt} (${counter})${ext}`)
    }

    return { resolvedPath: candidatePath, isConflict: true, shouldSkip: false }
  }

  /**
   * Safely moves a file from source to destination with:
   * 1. Path normalization & reserved name check
   * 2. Collision policy enforcement (ZERO silent overwrites)
   * 3. Pre-hash computation
   * 4. Safe attempt with TOCTOU-aware error recovery
   * 5. Destination hash verification (source hash === destination hash)
   */
  async moveFile(
    rawSource: string,
    rawDestination: string,
    options?: MoveFileOptions
  ): Promise<MoveFileResult> {
    const policy = options?.collisionPolicy ?? 'rename_with_counter'
    const computeHashes = options?.computeHashes ?? true

    const sourcePath = this.normalizer.normalizePath(rawSource)
    const destinationPath = this.normalizer.normalizePath(rawDestination)

    // Check reserved names
    const srcReserved = WindowsPathNormalizer.isValidPathSyntax(sourcePath)
    if (!srcReserved.valid) {
      return {
        status: 'failed_error',
        sourcePath,
        destinationPath,
        verified: false,
        error: srcReserved.reason,
        resolvedDestination: destinationPath,
      }
    }

    const destReserved = WindowsPathNormalizer.isValidPathSyntax(destinationPath)
    if (!destReserved.valid) {
      return {
        status: 'failed_error',
        sourcePath,
        destinationPath,
        verified: false,
        error: destReserved.reason,
        resolvedDestination: destinationPath,
      }
    }

    // Check source existence
    if (!(await this.pathExists(sourcePath))) {
      return {
        status: 'failed_not_found',
        sourcePath,
        destinationPath,
        verified: false,
        error: `Source file does not exist: ${sourcePath}`,
        resolvedDestination: destinationPath,
      }
    }

    // Resolve collision
    let resolvedDest = destinationPath
    try {
      const conflictRes = await this.resolveDestinationConflict(destinationPath, policy)
      if (conflictRes.shouldSkip) {
        return {
          status: 'skipped_conflict',
          sourcePath,
          destinationPath,
          verified: false,
          error: `Destination file already exists (skipped under policy 'skip'): ${destinationPath}`,
          resolvedDestination: destinationPath,
        }
      }
      resolvedDest = conflictRes.resolvedPath
    } catch (err: unknown) {
      return {
        status: 'failed_error',
        sourcePath,
        destinationPath,
        verified: false,
        error: err instanceof Error ? err.message : String(err),
        resolvedDestination: destinationPath,
      }
    }

    // Ensure target directory exists
    await fs.mkdir(dirname(resolvedDest), { recursive: true })

    // Compute source hash before operation
    let sourceHash: string | undefined
    if (computeHashes) {
      try {
        sourceHash = await this.computeFileHash(sourcePath)
      } catch (err: unknown) {
        const classified = this.classifyFsError(err)
        if (classified.category === 'locked') {
          return {
            status: 'failed_locked',
            sourcePath,
            destinationPath: resolvedDest,
            verified: false,
            error: `File is locked by another process: ${sourcePath} (${classified.message})`,
            resolvedDestination: resolvedDest,
          }
        }
        if (classified.category === 'permission') {
          return {
            status: 'failed_permission',
            sourcePath,
            destinationPath: resolvedDest,
            verified: false,
            error: `Permission denied reading source: ${sourcePath} (${classified.message})`,
            resolvedDestination: resolvedDest,
          }
        }
        return {
          status: 'failed_error',
          sourcePath,
          destinationPath: resolvedDest,
          verified: false,
          error: classified.message,
          resolvedDestination: resolvedDest,
        }
      }
    }

    // Attempt operation with TOCTOU-aware OS error trapping
    try {
      await fs.rename(sourcePath, resolvedDest)
    } catch (renameErr: unknown) {
      const classified = this.classifyFsError(renameErr)

      if (classified.category === 'cross_device') {
        // EXDEV: Cross partition / volume move (e.g. C:\ -> D:\ or network share)
        // Fallback: copy to temp destination -> verify destination hash -> unlink source
        try {
          await fs.copyFile(sourcePath, resolvedDest)
          if (sourceHash) {
            const tempDestHash = await this.computeFileHash(resolvedDest)
            if (tempDestHash !== sourceHash) {
              await fs.unlink(resolvedDest).catch(() => {})
              throw new Error(`Cross-device move hash mismatch: source=${sourceHash}, dest=${tempDestHash}`)
            }
          }
          await fs.unlink(sourcePath)
        } catch (copyErr: unknown) {
          const copyClassified = this.classifyFsError(copyErr)
          return {
            status: copyClassified.category === 'locked' ? 'failed_locked' : 'failed_error',
            sourcePath,
            destinationPath: resolvedDest,
            verified: false,
            error: `Cross-device move failed: ${copyClassified.message}`,
            resolvedDestination: resolvedDest,
          }
        }
      } else if (classified.category === 'locked') {
        return {
          status: 'failed_locked',
          sourcePath,
          destinationPath: resolvedDest,
          verified: false,
          error: `Failed to move locked file (sharing violation / process lock): ${sourcePath}`,
          resolvedDestination: resolvedDest,
        }
      } else if (classified.category === 'permission') {
        return {
          status: 'failed_permission',
          sourcePath,
          destinationPath: resolvedDest,
          verified: false,
          error: `Permission denied moving file to ${resolvedDest}`,
          resolvedDestination: resolvedDest,
        }
      } else {
        return {
          status: 'failed_error',
          sourcePath,
          destinationPath: resolvedDest,
          verified: false,
          error: classified.message,
          resolvedDestination: resolvedDest,
        }
      }
    }

    // Verify destination hash matches source hash
    let destinationHash: string | undefined
    let verified = false
    if (computeHashes && sourceHash) {
      try {
        destinationHash = await this.computeFileHash(resolvedDest)
        verified = sourceHash === destinationHash
        if (!verified) {
          return {
            status: 'failed_error',
            sourcePath,
            destinationPath: resolvedDest,
            sourceHash,
            destinationHash,
            verified: false,
            error: `Verification failed: destination hash (${destinationHash}) does not match source hash (${sourceHash})`,
            resolvedDestination: resolvedDest,
          }
        }
      } catch (hashErr: unknown) {
        return {
          status: 'failed_error',
          sourcePath,
          destinationPath: resolvedDest,
          sourceHash,
          verified: false,
          error: `Failed computing destination hash for verification: ${hashErr instanceof Error ? hashErr.message : String(hashErr)}`,
          resolvedDestination: resolvedDest,
        }
      }
    } else {
      // If hashes not computed, verify target exists and size > 0 or 0
      verified = await this.pathExists(resolvedDest)
    }

    return {
      status: 'success',
      sourcePath,
      destinationPath: resolvedDest,
      sourceHash,
      destinationHash,
      verified,
      resolvedDestination: resolvedDest,
    }
  }
}
