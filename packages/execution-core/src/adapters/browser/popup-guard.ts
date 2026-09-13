import type { Page } from 'playwright'

export class PopupGuard {
  /**
   * Common selectors for cookie consent banners, GDPR dialogs, and promotional overlays.
   */
  static readonly DISMISS_SELECTORS = [
    // Cookie / Consent accept buttons
    'button:has-text("Accept all")',
    'button:has-text("Accept All")',
    'button:has-text("Accept cookies")',
    'button:has-text("Accept Cookies")',
    'button:has-text("Accept")',
    'button:has-text("I Agree")',
    'button:has-text("I agree")',
    'button:has-text("Agree")',
    'button:has-text("Got it")',
    'button:has-text("Allow all")',
    'button:has-text("Allow All")',
    'button:has-text("OK")',

    // Close & dismiss buttons on modals
    'button[aria-label="Close" i]',
    'button[aria-label="Dismiss" i]',
    'button:has-text("Dismiss")',
    'button:has-text("Close")',
    'button.close',
    '[class*="close-button" i]',
    '[class*="cookie" i] button',
    '[id*="cookie" i] button',
  ]

  /**
   * Checks if an error is caused by a modal, overlay, or banner intercepting pointer events.
   */
  static isClickInterceptedError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
    return (
      msg.includes('intercept') ||
      msg.includes('another element would receive the click') ||
      msg.includes('element is not clickable') ||
      msg.includes('obscured by') ||
      msg.includes('pointer-events')
    )
  }

  /**
   * Scans the page for any visible cookie banners, GDPR prompts, or modals
   * and attempts to dismiss them. Returns true if an overlay was dismissed.
   */
  static async dismissKnownOverlays(page: Page, timeoutMs = 1500): Promise<boolean> {
    for (const selector of PopupGuard.DISMISS_SELECTORS) {
      try {
        const locator = page.locator(selector).first()
        const count = await locator.count().catch(() => 0)
        if (count > 0 && (await locator.isVisible().catch(() => false))) {
          await locator.click({ timeout: timeoutMs }).catch(() => {})
          await page.waitForTimeout(200)
          return true
        }
      } catch {
        // Continue checking other candidates
      }
    }
    return false
  }

  /**
   * Wraps an action so that if a click is intercepted by a modal or overlay,
   * it auto-dismisses the overlay and retries the action.
   */
  static async executeWithOverlayDismissal(
    page: Page,
    action: () => Promise<void>
  ): Promise<void> {
    // Proactively dismiss any known overlays/cookie banners currently visible
    await PopupGuard.dismissKnownOverlays(page, 1000).catch(() => {})

    try {
      await action()
    } catch (err: unknown) {
      if (PopupGuard.isClickInterceptedError(err)) {
        const dismissed = await PopupGuard.dismissKnownOverlays(page, 2000)
        if (dismissed) {
          // Retry the action after overlay dismissal
          await action()
          return
        }
      }
      throw err
    }
  }
}
