import { sleep } from './async'

export interface RetryOptions {
  /** Maximum number of attempts (including the first try) */
  maxAttempts: number
  /** Initial delay in ms — doubles with each attempt */
  initialDelayMs: number
  /** Maximum delay cap in ms */
  maxDelayMs: number
  /** Optional predicate to determine if an error is retryable */
  isRetryable?: (error: unknown) => boolean
  /** Called on each failed attempt before retry */
  onRetry?: (error: unknown, attempt: number) => void
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
}

/**
 * Retry an async operation with exponential backoff.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options }
  let lastError: unknown

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      if (attempt === opts.maxAttempts) break
      if (opts.isRetryable && !opts.isRetryable(error)) break

      opts.onRetry?.(error, attempt)

      const delay = Math.min(opts.initialDelayMs * Math.pow(2, attempt - 1), opts.maxDelayMs)
      await sleep(delay)
    }
  }

  throw lastError
}
