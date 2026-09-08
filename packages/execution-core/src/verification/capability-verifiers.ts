import { createHash } from 'node:crypto'
import { promises as fs } from 'node:fs'

import type { AdapterResult, VerificationResult } from '@usepilot/execution-types'
import type { Task, ExecutionBlueprint } from '@usepilot/planner-types'

export interface VerifierContext {
  task: Task
  blueprint: ExecutionBlueprint
  result: AdapterResult
}

export interface ICapabilityVerifier {
  verify(ctx: VerifierContext): Promise<VerificationResult>
}

export class BrowserStateVerifier implements ICapabilityVerifier {
  async verify(ctx: VerifierContext): Promise<VerificationResult> {
    const start = Date.now()
    const output = (ctx.result.output ?? {}) as Record<string, unknown>
    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    if (!ctx.result.success) {
      return {
        passed: false,
        checkedConditions,
        failedConditions: ['Browser execution did not return success status'],
        strategy: 'state_check',
        durationMs: Date.now() - start,
        notes: ctx.result.error,
      }
    }

    if (ctx.task.requiredCapability === 'navigate_website' || ctx.task.requiredCapability === 'search_web') {
      if (typeof output['url'] === 'string' && output['url'].length > 0 && output['url'] !== 'about:blank') {
        checkedConditions.push(`Browser navigated successfully to: ${output['url']}`)
      } else {
        failedConditions.push('Browser navigation produced invalid or blank URL')
      }
    } else if (ctx.task.requiredCapability === 'download_file') {
      if (output['downloaded'] === true && typeof output['path'] === 'string') {
        try {
          const stats = await fs.stat(output['path'])
          if (stats.size > 0) {
            checkedConditions.push(`Downloaded file confirmed on disk (${stats.size} bytes)`)
          } else {
            failedConditions.push(`Downloaded file has zero bytes`)
          }
        } catch {
          failedConditions.push(`Downloaded file not found on disk at ${output['path']}`)
        }
      } else {
        failedConditions.push('Download event was not acknowledged')
      }
    } else if (ctx.task.requiredCapability === 'extract_web_data') {
      if (typeof output['text'] === 'string') {
        checkedConditions.push(`Extracted content returned (${output['text'].length} chars)`)
      } else {
        failedConditions.push('No extracted content returned from target selector')
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
  }
}

export class FilesystemVerifier implements ICapabilityVerifier {
  async verify(ctx: VerifierContext): Promise<VerificationResult> {
    const start = Date.now()
    const output = (ctx.result.output ?? {}) as Record<string, unknown>
    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    if (!ctx.result.success) {
      return {
        passed: false,
        checkedConditions,
        failedConditions: ['Filesystem execution failed'],
        strategy: 'state_check',
        durationMs: Date.now() - start,
        notes: ctx.result.error,
      }
    }

    try {
      if (ctx.task.requiredCapability === 'write_file' && typeof output['path'] === 'string') {
        const stats = await fs.stat(output['path'])
        if (stats.size >= 0) {
          const data = await fs.readFile(output['path'])
          const checksum = createHash('sha256').update(data).digest('hex')
          checkedConditions.push(`File verified at ${output['path']} (SHA-256: ${checksum.slice(0, 8)}...)`)
        } else {
          failedConditions.push(`File at ${output['path']} has invalid size`)
        }
      } else if (ctx.task.requiredCapability === 'delete_file' && typeof output['path'] === 'string') {
        try {
          await fs.stat(output['path'])
          failedConditions.push(`File still exists at ${output['path']}`)
        } catch {
          checkedConditions.push(`File confirmed deleted at ${output['path']}`)
        }
      } else if (ctx.task.requiredCapability === 'move_file' && typeof output['destination'] === 'string') {
        const stats = await fs.stat(output['destination'])
        if (stats.isFile() || stats.isDirectory()) {
          checkedConditions.push(`Destination confirmed exists at ${output['destination']}`)
        }
      } else {
        checkedConditions.push(...ctx.task.successConditions)
      }
    } catch (err: unknown) {
      failedConditions.push(err instanceof Error ? err.message : String(err))
    }

    return {
      passed: failedConditions.length === 0,
      checkedConditions,
      failedConditions,
      strategy: 'state_check',
      durationMs: Date.now() - start,
    }
  }
}

export class DesktopStateVerifier implements ICapabilityVerifier {
  async verify(ctx: VerifierContext): Promise<VerificationResult> {
    const start = Date.now()
    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    if (!ctx.result.success) {
      return {
        passed: false,
        checkedConditions,
        failedConditions: ['Desktop execution did not succeed'],
        strategy: 'state_check',
        durationMs: Date.now() - start,
        notes: ctx.result.error,
      }
    }

    checkedConditions.push(...ctx.task.successConditions)
    return {
      passed: true,
      checkedConditions,
      failedConditions,
      strategy: 'state_check',
      durationMs: Date.now() - start,
    }
  }
}
