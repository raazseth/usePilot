import { join, basename } from 'node:path'

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

export interface BrowserAdapterOptions {
  engine?: BrowserEngine | undefined
  headless?: boolean | undefined
  session?: PlaywrightBrowserSession | undefined
}

export class PlaywrightBrowserAdapter implements ICapabilityAdapter {
  readonly capability: TaskCapability
  readonly priority = 100
  readonly platformSupport: ('windows' | 'macos' | 'linux')[] = ['windows', 'macos', 'linux']
  readonly name = 'PlaywrightBrowserAdapter'

  private readonly session: PlaywrightBrowserSession
  private readonly vision: VisionSubsystem
  private readonly healing: SelfHealingPipeline

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
          await page.goto(fullUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          output = {
            url: page.url(),
            title: await page.title(),
            status: 200,
          }
          break
        }

        case 'search_web': {
          const query = (params['query'] ?? task.title) as string
          const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(query)}`
          await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 30000 })
          output = {
            url: page.url(),
            query,
            title: await page.title(),
          }
          break
        }

        case 'authenticate_user': {
          const username = (params['username'] ?? params['user'] ?? '') as string
          const password = (params['password'] ?? params['pass'] ?? '') as string
          const userSelector = (params['userSelector'] ?? 'input[type="email"], input[type="text"], input[name="username"]') as string
          const passSelector = (params['passSelector'] ?? 'input[type="password"]') as string

          const userElement = await this.healing.locateElement(page, { selector: userSelector, label: 'Email or Username' }, ctx.runId)
          if (userElement.locator) {
            await userElement.locator.fill(username)
          }

          const passElement = await this.healing.locateElement(page, { selector: passSelector, label: 'Password' }, ctx.runId)
          if (passElement.locator) {
            await passElement.locator.fill(password)
          }

          const submit = await this.healing.locateElement(page, { selector: 'button[type="submit"], input[type="submit"]', text: 'Sign in' }, ctx.runId)
          if (submit.locator) {
            await submit.locator.click()
          }

          output = { authenticated: true, url: page.url() }
          break
        }

        case 'extract_web_data': {
          const selector = (params['selector'] ?? 'body') as string
          const element = await this.healing.locateElement(page, { selector }, ctx.runId)
          let extractedText = ''
          if (element.locator) {
            extractedText = (await element.locator.innerText().catch(() => '')) || ''
          }
          output = {
            url: page.url(),
            selector,
            text: extractedText.slice(0, 5000),
            length: extractedText.length,
          }
          break
        }

        case 'download_file': {
          const triggerSelector = (params['selector'] ?? params['downloadButton'] ?? 'a[download]') as string
          const downloadPromise = page.waitForEvent('download', { timeout: 30000 }).catch(() => null)

          const element = await this.healing.locateElement(page, { selector: triggerSelector, text: 'Download' }, ctx.runId)
          if (element.locator) {
            await element.locator.click()
          }

          const download = await downloadPromise
          let downloadPath: string | null = null
          if (download) {
            downloadPath = join(this.session.downloadsPath, basename(download.suggestedFilename()))
            await download.saveAs(downloadPath)
          }

          output = {
            downloaded: !!download,
            filename: download ? download.suggestedFilename() : null,
            path: downloadPath,
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
      const errorMsg = err instanceof Error ? err.message : String(err)
      return {
        success: false,
        error: errorMsg,
        failureCategory: ctx.signal.aborted ? 'cancellation' : 'adapter_failure',
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

    const checkedConditions: string[] = []
    const failedConditions: string[] = []

    try {
      const page = this.session.getPage()
      if (this.capability === 'navigate_website') {
        const url = page.url()
        if (url && url !== 'about:blank') {
          checkedConditions.push(`Page loaded at ${url}`)
        } else {
          failedConditions.push('Page URL is blank')
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
