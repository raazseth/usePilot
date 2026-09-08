import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

import { chromium, firefox } from 'playwright'
import type { Browser, BrowserContext, Page, LaunchOptions } from 'playwright'

export type BrowserEngine = 'chromium' | 'firefox' | 'chrome' | 'edge' | 'brave'

export interface BrowserSessionConfig {
  engine?: BrowserEngine | undefined
  headless?: boolean | undefined
  userDataDir?: string | undefined
  downloadsPath?: string | undefined
}

export class PlaywrightBrowserSession {
  private browser: Browser | null = null
  private context: BrowserContext | null = null
  private activePage: Page | null = null
  private readonly pages: Page[] = []

  readonly engine: BrowserEngine
  readonly headless: boolean
  readonly userDataDir: string
  readonly downloadsPath: string

  constructor(config?: BrowserSessionConfig | undefined) {
    this.engine = config?.engine ?? 'chromium'
    this.headless = config?.headless ?? true
    this.userDataDir = config?.userDataDir ?? join(homedir(), '.usepilot', 'browser-profiles', this.engine)
    this.downloadsPath = config?.downloadsPath ?? join(homedir(), 'Downloads', 'usePilot')

    if (!existsSync(this.userDataDir)) {
      mkdirSync(this.userDataDir, { recursive: true })
    }
    if (!existsSync(this.downloadsPath)) {
      mkdirSync(this.downloadsPath, { recursive: true })
    }
  }

  async initialize(): Promise<void> {
    if (this.context && this.activePage) return

    if (this.engine === 'firefox') {
      this.browser = await firefox.launch({
        headless: this.headless,
      })
      this.context = await this.browser.newContext({
        acceptDownloads: true,
      })
    } else {
      const channelsToTry: (string | undefined)[] = []
      if (this.engine === 'chrome') {
        channelsToTry.push('chrome')
      } else if (this.engine === 'edge') {
        channelsToTry.push('msedge')
      } else if (this.engine === 'brave') {
        channelsToTry.push('chrome')
      } else {
        if (process.platform === 'win32') {
          channelsToTry.push('msedge', 'chrome', undefined)
        } else {
          channelsToTry.push('chrome', undefined)
        }
      }

      let launched = false
      for (const ch of channelsToTry) {
        try {
          const opts: LaunchOptions = { headless: this.headless }
          if (ch) opts.channel = ch
          this.browser = await chromium.launch(opts)
          this.context = await this.browser.newContext({
            acceptDownloads: true,
            viewport: { width: 1280, height: 800 },
          })
          launched = true
          break
        } catch {
          // Try next channel
        }
      }

      if (!launched) {
        this.browser = await chromium.launch({ headless: this.headless })
        this.context = await this.browser.newContext({ acceptDownloads: true })
      }
    }

    if (!this.context) {
      throw new Error('Failed to create browser context')
    }

    this.activePage = await this.context.newPage()
    this.pages.push(this.activePage)
  }

  getPage(): Page {
    if (!this.activePage) {
      throw new Error('Browser session not initialized. Call initialize() first.')
    }
    return this.activePage
  }

  getContext(): BrowserContext {
    if (!this.context) {
      throw new Error('Browser context not initialized.')
    }
    return this.context
  }

  async newTab(url?: string | undefined): Promise<Page> {
    const ctx = this.getContext()
    const page = await ctx.newPage()
    this.pages.push(page)
    this.activePage = page
    if (url) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
    }
    return page
  }

  async switchTab(index: number): Promise<Page> {
    if (index >= 0 && index < this.pages.length) {
      this.activePage = this.pages[index]!
      return this.activePage
    }
    throw new Error(`Tab index ${index} out of bounds (total tabs: ${this.pages.length})`)
  }

  async captureScreenshot(): Promise<Buffer> {
    const page = this.getPage()
    return await page.screenshot({ fullPage: false })
  }

  async recover(): Promise<boolean> {
    try {
      if (this.activePage) {
        await this.activePage.close().catch(() => {})
      }
      if (this.context) {
        this.activePage = await this.context.newPage()
        return true
      }
      return false
    } catch {
      return false
    }
  }

  async close(): Promise<void> {
    for (const p of this.pages) {
      await p.close().catch(() => {})
    }
    this.pages.length = 0
    this.activePage = null

    if (this.context) {
      await this.context.close().catch(() => {})
      this.context = null
    }
    if (this.browser) {
      await this.browser.close().catch(() => {})
      this.browser = null
    }
  }
}
