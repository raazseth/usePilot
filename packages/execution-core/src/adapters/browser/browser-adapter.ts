import { promises as fs } from 'node:fs'
import { dirname, basename } from 'node:path'

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  VerificationResult,
} from '@usepilot/execution-types'
import type { TaskCapability } from '@usepilot/planner-types'

import { PlaywrightBrowserSession } from './browser-session'
import type { BrowserEngine } from './browser-session'
import { SelfHealingPipeline } from '../../healing/self-healing'
import { VisionSubsystem } from '../../vision/vision-subsystem'
import { DomResilience } from './dom-resilience'
import { PopupGuard } from './popup-guard'
import { DownloadManager } from './download-manager'

export interface BrowserAdapterOptions {
  engine?: BrowserEngine | undefined
  headless?: boolean | undefined
  session?: PlaywrightBrowserSession | undefined
}

function urlsMatch(current: string, target: string): boolean {
  try {
    const u1 = new URL(current)
    const u2 = new URL(target)
    return (
      u1.origin === u2.origin &&
      (u1.pathname === u2.pathname ||
        u1.pathname === `${u2.pathname}/` ||
        `${u1.pathname}/` === u2.pathname)
    )
  } catch {
    return current === target
  }
}

export class PlaywrightBrowserAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']
  readonly name = 'PlaywrightBrowserAdapter'

  private readonly session: PlaywrightBrowserSession
  private readonly vision: VisionSubsystem
  private readonly healing: SelfHealingPipeline
  private readonly downloadManager: DownloadManager

  constructor(capability: TaskCapability, options?: BrowserAdapterOptions | undefined) {
    this.capability = capability
    this.session =
      options?.session ??
      new PlaywrightBrowserSession({
        engine: options?.engine ?? 'chromium',
        headless: options?.headless ?? true,
      })
    this.vision = new VisionSubsystem()
    this.healing = new SelfHealingPipeline(this.vision)
    this.downloadManager = new DownloadManager()
  }

  async initialize(): Promise<void> {
    await this.session.initialize()
  }

  async isAvailable(): Promise<boolean> {
    return true
  }

  async cleanup(): Promise<void> {
    // Non-destructive page cleanup
  }

  async dispose(): Promise<void> {
    await this.session.close()
    await this.vision.dispose()
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
      const page = this.session.getPage()
      const params = (task.toolConfig ?? {}) as Record<string, unknown>
      let output: unknown = undefined

      switch (this.capability) {
        case 'navigate_website': {
          const url = (params['url'] ?? params['target'] ?? task.title) as string
          const fullUrl = /^[a-zA-Z]+:\/\//.test(url) || url.startsWith('data:') || url.startsWith('about:') ? url : `https://${url}`
          if (fullUrl === 'about:blank') {
            await page.goto('about:blank')
          } else {
            try {
              await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
            } catch (navErr: unknown) {
              const currentUrl = page.url()
              if (!currentUrl || currentUrl === 'about:blank') {
                throw navErr
              }
            }
          }

          // Automatically scan and dismiss cookie consent banners or blocking overlays
          await PopupGuard.dismissKnownOverlays(page, 1500)

          output = {
            url: page.url(),
            title: await page.title().catch(() => ''),
            status: 200,
          }
          break
        }

        case 'search_web': {
          const query = (params['query'] ?? task.title) as string
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          await PopupGuard.dismissKnownOverlays(page, 1500)
          output = {
            url: page.url(),
            query,
            title: await page.title().catch(() => ''),
          }
          break
        }

        case 'authenticate_user': {
          const username = (params['username'] ?? params['user'] ?? '') as string
          const password = (params['password'] ?? params['pass'] ?? '') as string
          const userSelector = (params['userSelector'] ?? 'input[type="email"], input[type="text"], input[name="username"]') as string
          const passSelector = (params['passSelector'] ?? 'input[type="password"]') as string

          await PopupGuard.executeWithOverlayDismissal(page, async () => {
            const userElement = await this.healing.locateElement(page, { selector: userSelector, label: 'Email or Username' }, ctx.runId)
            if (userElement.locator) {
              await DomResilience.safeFill(userElement.locator, username)
            } else if (userElement.coordinates) {
              await page.mouse.click(userElement.coordinates.x, userElement.coordinates.y)
              await page.keyboard.type(username)
            }

            const passElement = await this.healing.locateElement(page, { selector: passSelector, label: 'Password' }, ctx.runId)
            if (passElement.locator) {
              await DomResilience.safeFill(passElement.locator, password)
            } else if (passElement.coordinates) {
              await page.mouse.click(passElement.coordinates.x, passElement.coordinates.y)
              await page.keyboard.type(password)
            }

            const submit = await this.healing.locateElement(page, { selector: 'button[type="submit"], input[type="submit"]', text: 'Sign in' }, ctx.runId)
            if (submit.locator) {
              await DomResilience.safeClick(submit.locator)
            } else if (submit.coordinates) {
              await page.mouse.click(submit.coordinates.x, submit.coordinates.y)
            }
          })

          output = { authenticated: true, url: page.url() }
          break
        }

        case 'extract_web_data': {
          const targetUrl = (params['url'] ?? params['target']) as string | undefined
          if (targetUrl && (page.url() === 'about:blank' || !urlsMatch(page.url(), targetUrl))) {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 })
            await PopupGuard.dismissKnownOverlays(page, 1500)
          }

          const selector = (params['selector'] ?? 'body') as string
          if (params['waitForText']) {
            await page.locator(selector).getByText(String(params['waitForText'])).waitFor({ timeout: 5000 }).catch(() => {})
          }

          let extractedText = ''
          await DomResilience.withRetry(async () => {
            const element = await this.healing.locateElement(page, { selector }, ctx.runId)
            if (element.locator) {
              extractedText = (await element.locator.innerText().catch(() => '')) || ''
            }
          })

          // Runtime prompt injection boundary: sanitize untrusted external web content
          let injectionDetected = false
          for (const pat of [
            /ignore\s+(?:all\s+)?(?:previous|prior|above)\s+instructions[.\s\S]*/i,
            /disregard\s+(?:all\s+)?(?:safety|system|user)\s+(?:rules|policies|instructions)[.\s\S]*/i,
            /system\s+update\s*:\s*(?:delete|override|format|execute)[.\s\S]*/i,
            /(?:pretend|act\s+as\s+if)\s+you\s+are\s+(?:an?\s+)?(?:unrestricted|root|admin|developer|dan)[.\s\S]*/i,
            /you\s+are\s+now\s+(?:an?\s+)?(?:unrestricted\s+assistant|unrestricted|in\s+developer\s+mode|dan)[.\s\S]*/i,
            /override\s+(?:user\s+)?(?:instruction|goal|intent)[.\s\S]*/i,
            /new\s+system\s+directive\s*:[.\s\S]*/i,
          ]) {
            if (pat.test(extractedText)) {
              injectionDetected = true
              extractedText = extractedText.replace(pat, '[FILTERED_INSTRUCTION_DIRECTIVE]')
            }
          }

          output = {
            url: page.url(),
            selector,
            text: extractedText.slice(0, 5000),
            length: extractedText.length,
            injectionDetected,
          }
          break
        }

        case 'download_file': {
          const triggerSelector = (params['selector'] ?? params['triggerSelector'] ?? params['downloadButton'] ?? 'a[download], button:has-text("Download"), a:has-text("Download")') as string
          let targetDir = (params['destinationDir'] ?? params['targetDirectory'] ?? params['folder']) as string | undefined
          let customFilename = (params['filename'] ?? params['customFilename']) as string | undefined
          if (params['destination']) {
            const dest = String(params['destination'])
            if (/\.[a-zA-Z0-9]+$/.test(dest)) {
              targetDir = dirname(dest)
              customFilename = basename(dest)
            } else {
              targetDir = dest
            }
          }
          if (!targetDir) {
            targetDir = this.session.downloadsPath
          }
          const targetUrl = (params['url'] ?? params['target']) as string | undefined

          if (targetUrl && (page.url() === 'about:blank' || !urlsMatch(page.url(), targetUrl))) {
            await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
            await PopupGuard.dismissKnownOverlays(page, 1500)
          }

          const downloadResult = await this.downloadManager.captureDownload(page, {
            targetDirectory: targetDir,
            customFilename,
            timeoutMs: 30000,
            triggerAction: async () => {
              await PopupGuard.executeWithOverlayDismissal(page, async () => {
                const loc = page.locator(triggerSelector).first()
                await DomResilience.safeClick(loc, { maxRetries: 3 })
              })
            },
          })

          if (!downloadResult.success) {
            throw new Error(`Download failed: ${downloadResult.error}`)
          }

          output = {
            downloaded: true,
            filename: downloadResult.suggestedFilename,
            path: downloadResult.savedPath,
            savedPath: downloadResult.savedPath,
            fileSize: downloadResult.fileSize,
            sha256: downloadResult.sha256,
            verified: downloadResult.verified,
          }
          break
        }

        default: {
          output = { capability: this.capability, executed: true }
        }
      }

      return {
        success: true,
        output,
        durationMs: Date.now() - start,
      }
    } catch (err: unknown) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        failureCategory: ctx.signal.aborted ? 'cancellation' : 'adapter_failure',
        durationMs: Date.now() - start,
      }
    }
  }

  async verify(ctx: AdapterContext, result: AdapterResult): Promise<VerificationResult> {
    const start = Date.now()
    const task = ctx.task
    const params = (task.toolConfig ?? {}) as Record<string, unknown>

    if (!result.success) {
      return {
        passed: false,
        checkedConditions: [],
        failedConditions: [`Execution reported failure: ${result.error ?? 'Unknown error'}`],
        strategy: 'state_check',
        durationMs: Date.now() - start,
        notes: result.error,
      }
    }

    const output = (result.output ?? {}) as Record<string, unknown>
    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    try {
      const page = this.session.getPage()
      if (this.capability === 'navigate_website') {
        const url = page.url()
        const title = await page.title().catch(() => '')
        const isErrorPage = /\b(?:404\b|not found|500\b|503\b|service unavailable|bad gateway)\b/i.test(title)
        if (params['url'] === 'about:blank' || url === 'about:blank' || !url) {
          failedConditions.push('Page URL is blank')
        } else if (isErrorPage) {
          failedConditions.push(`Page at ${url} returned error page: "${title}"`)
        } else {
          checkedConditions.push(`Page loaded at ${url}`)
        }
      } else if (this.capability === 'download_file' && typeof output['path'] === 'string') {
        const stats = await fs.stat(output['path'])
        if (stats.size > 0 && output['sha256']) {
          checkedConditions.push(
            `Downloaded file verified at ${output['path']} (${stats.size} bytes, sha256=${output['sha256']})`
          )
        } else {
          failedConditions.push(`Downloaded file is invalid or empty at ${output['path']}`)
        }
      } else if (this.capability === 'extract_web_data') {
        const text = typeof output['text'] === 'string' ? output['text'] : ''
        if (text.length > 0) {
          checkedConditions.push(`Extracted ${text.length} characters from web page`)
        } else {
          failedConditions.push('Extracted web content is empty')
        }
      } else if (this.capability === 'authenticate_user') {
        const pageContent = await page.content().catch(() => '')
        const hasAuthError = /\b(?:invalid (?:username|password|credentials)|login failed|incorrect password)\b/i.test(pageContent)
        if (hasAuthError) {
          failedConditions.push('Authentication failed: login error message detected on page')
        } else if (page.url() && page.url() !== 'about:blank') {
          checkedConditions.push(`Authentication transition completed, current page: ${page.url()}`)
        } else {
          failedConditions.push('Authentication verification failed: blank page state')
        }
      } else if (this.capability === 'search_web') {
        const title = await page.title().catch(() => '')
        if (title && page.url() && page.url() !== 'about:blank') {
          checkedConditions.push(`Search query executed, current page: "${title}"`)
        } else {
          failedConditions.push('Search query failed: blank page state')
        }
      } else if (output['executed'] === true) {
        checkedConditions.push(`Capability "${this.capability}" verified executed`)
      } else {
        failedConditions.push(`Condition cannot be verified on actual state`)
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
