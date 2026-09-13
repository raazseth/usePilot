import type { Locator, Page } from 'playwright'

export interface DomRetryOptions {
  maxRetries?: number | undefined
  backoffMs?: number | undefined
  timeoutMs?: number | undefined
}

export class DomResilience {
  /**
   * Common transient errors thrown by Playwright when DOM nodes detach,
   * re-render, or are covered by dynamic layers.
   */
  static isTransientDomError(err: unknown): boolean {
    const msg = (err instanceof Error ? err.message : String(err)).toLowerCase()
    if (
      msg.includes('would receive the click') ||
      msg.includes('intercept') ||
      msg.includes('element is not clickable')
    ) {
      return false
    }
    return (
      msg.includes('stale element') ||
      msg.includes('not attached') ||
      msg.includes('detached from document') ||
      msg.includes('target closed') ||
      msg.includes('frame was detached') ||
      msg.includes('element is not visible') ||
      msg.includes('element is not stable') ||
      msg.includes('waiting for element to be visible')
    )
  }

  /**
   * Executes an asynchronous DOM operation with exponential backoff retries
   * on transient detachment/stale errors.
   */
  static async withRetry<T>(
    operation: () => Promise<T>,
    options?: DomRetryOptions | undefined
  ): Promise<T> {
    const maxRetries = options?.maxRetries ?? 3
    const backoffMs = options?.backoffMs ?? 200

    let lastError: unknown
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation()
      } catch (err: unknown) {
        lastError = err
        if (!DomResilience.isTransientDomError(err) || attempt === maxRetries) {
          throw err
        }
        await new Promise((resolve) => setTimeout(resolve, backoffMs * attempt))
      }
    }
    throw lastError
  }

  /**
   * Safely clicks an element:
   * 1. Scrolls into view if needed
   * 2. Waits for visibility
   * 3. Retries on detachment or staleness
   */
  static async safeClick(
    locator: Locator,
    options?: DomRetryOptions | undefined
  ): Promise<void> {
    await DomResilience.withRetry(async () => {
      await locator.scrollIntoViewIfNeeded().catch(() => {})
      await locator.click({ timeout: options?.timeoutMs ?? 5000 })
    }, options)
  }

  /**
   * Safely fills an input element with text:
   * 1. Waits for element to be enabled
   * 2. Clears existing text
   * 3. Fills with new value
   */
  static async safeFill(
    locator: Locator,
    text: string,
    options?: DomRetryOptions | undefined
  ): Promise<void> {
    await DomResilience.withRetry(async () => {
      await locator.scrollIntoViewIfNeeded().catch(() => {})
      await locator.fill(text, { timeout: options?.timeoutMs ?? 5000 })
    }, options)
  }

  /**
   * Finds the first matching locator among a list of fallback selectors.
   */
  static async findFirstVisible(
    page: Page,
    selectors: string[],
    timeoutMs = 3000
  ): Promise<Locator | null> {
    for (const selector of selectors) {
      try {
        const loc = page.locator(selector).first()
        const visible = await loc.isVisible({ timeout: timeoutMs }).catch(() => false)
        if (visible) {
          return loc
        }
      } catch {
        // Continue to next candidate selector
      }
    }
    return null
  }
}
