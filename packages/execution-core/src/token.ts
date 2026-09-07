// Hierarchical Cancellation Token

export interface CancellationToken {
  readonly isCancellationRequested: boolean
  readonly signal: AbortSignal
  onCancelled(callback: () => void): () => void
}

export class CancellationTokenSource {
  private readonly abortController = new AbortController()
  private readonly listeners = new Set<() => void>()
  private parentUnsub?: () => void

  constructor(parentToken?: CancellationToken) {
    if (parentToken) {
      if (parentToken.isCancellationRequested) {
        this.cancel()
      } else {
        this.parentUnsub = parentToken.onCancelled(() => this.cancel())
      }
    }
  }

  get token(): CancellationToken {
    return {
      isCancellationRequested: this.abortController.signal.aborted,
      signal: this.abortController.signal,
      onCancelled: (cb: () => void) => {
        if (this.abortController.signal.aborted) {
          cb()
          return () => {}
        }
        this.listeners.add(cb)
        return () => {
          this.listeners.delete(cb)
        }
      },
    }
  }

  cancel(): void {
    if (this.abortController.signal.aborted) return
    this.abortController.abort()
    for (const listener of this.listeners) {
      try {
        listener()
      } catch {
        // Suppress listener callback errors
      }
    }
    this.listeners.clear()
    this.parentUnsub?.()
  }

  createChild(): CancellationTokenSource {
    return new CancellationTokenSource(this.token)
  }

  dispose(): void {
    this.parentUnsub?.()
    this.listeners.clear()
  }
}
