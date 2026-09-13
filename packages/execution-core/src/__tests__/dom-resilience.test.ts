import { describe, it, expect, afterAll, beforeAll } from 'vitest'
import { DomResilience } from '../adapters/browser/dom-resilience'
import { PopupGuard } from '../adapters/browser/popup-guard'
import { PlaywrightBrowserSession } from '../adapters/browser/browser-session'

describe('Browser Reality Hardening — DOM Resilience & Popup Guard', () => {
  const session = new PlaywrightBrowserSession({ headless: true })

  beforeAll(async () => {
    await session.initialize()
  })

  afterAll(async () => {
    await session.dispose()
  })

  describe('DomResilience error detection & retries', () => {
    it('accurately identifies transient DOM errors', () => {
      expect(DomResilience.isTransientDomError(new Error('Element is detached from document'))).toBe(true)
      expect(DomResilience.isTransientDomError(new Error('stale element reference: stale element not found'))).toBe(true)
      expect(DomResilience.isTransientDomError(new Error('Target closed'))).toBe(true)
      expect(DomResilience.isTransientDomError(new Error('Frame was detached'))).toBe(true)
      expect(DomResilience.isTransientDomError(new Error('SyntaxError: invalid selector'))).toBe(false)
      expect(DomResilience.isTransientDomError(new Error('TypeError: undefined is not a function'))).toBe(false)
    })

    it('retries transient failures and resolves upon recovery', async () => {
      let attempts = 0
      const result = await DomResilience.withRetry(
        async () => {
          attempts++
          if (attempts < 3) {
            throw new Error('Element is detached from document')
          }
          return 'recovered-value'
        },
        { maxRetries: 4, backoffMs: 10 }
      )

      expect(result).toBe('recovered-value')
      expect(attempts).toBe(3)
    })

    it('fails fast on non-transient errors without wasteful retries', async () => {
      let attempts = 0
      await expect(
        DomResilience.withRetry(
          async () => {
            attempts++
            throw new Error('Invalid JSON response format')
          },
          { maxRetries: 5, backoffMs: 10 }
        )
      ).rejects.toThrow('Invalid JSON response format')

      expect(attempts).toBe(1)
    })
  })

  describe('PopupGuard overlay detection and auto-dismissal', () => {
    it('detects click interception errors', () => {
      expect(
        PopupGuard.isClickInterceptedError(
          new Error('Element is not clickable at point (100, 100). Other element would receive the click: <div class="cookie-banner">...</div>')
        )
      ).toBe(true)
      expect(PopupGuard.isClickInterceptedError(new Error('element click intercepted'))).toBe(true)
      expect(PopupGuard.isClickInterceptedError(new Error('Timeout 5000ms exceeded'))).toBe(false)
    })

    it('dismisses cookie consent overlays blocking interaction', async () => {
      const page = await session.newTab(
        'data:text/html,' +
          encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: sans-serif; margin: 0; padding: 20px; }
            #overlay {
              position: fixed; top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0,0,0,0.85); color: white; display: flex;
              flex-direction: column; align-items: center; justify-content: center;
              z-index: 9999;
            }
            #main-btn {
              padding: 12px 24px; font-size: 16px; margin-top: 100px;
            }
          </style>
        </head>
        <body>
          <button id="main-btn" onclick="document.getElementById('status').innerText = 'Clicked!'">Submit Application</button>
          <div id="status">Waiting</div>

          <div id="overlay">
            <h2>Cookie & Privacy Preferences</h2>
            <p>We use cookies to ensure optimal experience.</p>
            <button id="accept-btn" onclick="document.getElementById('overlay').remove()">Accept All</button>
          </div>
        </body>
        </html>
      `)
      )

      // Test PopupGuard.dismissKnownOverlays directly
      const dismissed = await PopupGuard.dismissKnownOverlays(page)
      expect(dismissed).toBe(true)

      // Overlay should now be gone, main-btn clickable
      await page.click('#main-btn')
      const statusText = await page.textContent('#status')
      expect(statusText).toBe('Clicked!')

      await page.close()
    })

    it('executes action with automatic overlay recovery when click is intercepted', async () => {
      const page = await session.newTab(
        'data:text/html,' +
          encodeURIComponent(`
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            #cookie-bar {
              position: fixed; bottom: 0; left: 0; right: 0;
              background: #222; color: #fff; padding: 15px;
              z-index: 1000; text-align: center;
            }
            .target-btn {
              position: fixed; bottom: 10px; left: 10px;
            }
          </style>
        </head>
        <body>
          <button class="target-btn" onclick="window.clicked = true">Underneath Button</button>
          <div id="cookie-bar">
            <span>Notice: cookies enabled</span>
            <button onclick="document.getElementById('cookie-bar').remove()">I Agree</button>
          </div>
        </body>
        </html>
      `)
      )

      // Using executeWithOverlayDismissal
      await PopupGuard.executeWithOverlayDismissal(page, async () => {
        // If cookie-bar is removed by PopupGuard, this click succeeds
        await page.click('.target-btn', { timeout: 2000 })
      })

      const clicked = await page.evaluate(() => (globalThis as unknown as { clicked?: boolean }).clicked)
      expect(clicked).toBe(true)

      await page.close()
    })
  })

  describe('Multi-tab isolation and active tab tracking', () => {
    it('automatically tracks child popups and preserves session active page', async () => {
      const mainPage = await session.getActivePage()
      await mainPage.setContent(`
        <!DOCTYPE html>
        <html>
        <body>
          <h1>Main Control Panel</h1>
          <button id="child-link" onclick="window.open('about:blank', '_blank')">Open Report</button>
        </body>
        </html>
      `)

      const initialPageCount = session.getPages().length

      // Trigger child tab creation deterministically
      const [popup] = await Promise.all([
        session.getContext().waitForEvent('page'),
        mainPage.click('#child-link'),
      ])

      const pagesAfter = session.getPages()
      expect(pagesAfter.length).toBe(initialPageCount + 1)

      // Close the spawned popup tab
      await popup.close()

      // Active page should safely fallback to mainPage without crash
      const active = await session.getActivePage()
      expect(active).toBeDefined()
      const title = await active.title()
      expect(title).toBeDefined()
    })
  })
})
