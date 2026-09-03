/**
 * Sleep for a given number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Reject a promise after a timeout.
 */
export function timeout<T>(promise: Promise<T>, ms: number, message?: string): Promise<T> {
  const timer = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error(message ?? `Operation timed out after ${ms}ms`)), ms)
  )
  return Promise.race([promise, timer])
}
