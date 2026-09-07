// AdapterSandbox — isolates adapter execution, enforces timeouts, recovers panics

import type {
  ICapabilityAdapter,
  AdapterContext,
  AdapterResult,
  SandboxOptions,
  SandboxLogEntry,
  SandboxExecutionResult,
} from '@usepilot/execution-types'

export class AdapterSandbox {
  constructor(private readonly defaultOptions: SandboxOptions = {}) {}

  async execute(
    adapter: ICapabilityAdapter,
    ctx: AdapterContext,
    options?: SandboxOptions
  ): Promise<SandboxExecutionResult> {
    const opts: SandboxOptions = {
      timeoutMs: options?.timeoutMs ?? this.defaultOptions.timeoutMs ?? 60000,
      captureOutput: options?.captureOutput ?? this.defaultOptions.captureOutput ?? true,
      memoryLimitBytes: options?.memoryLimitBytes ?? this.defaultOptions.memoryLimitBytes,
    }

    const logs: SandboxLogEntry[] = []
    const log = (stream: SandboxLogEntry['stream'], message: string) => {
      if (opts.captureOutput) {
        logs.push({ stream, message, timestamp: Date.now() })
      }
    }

    const start = Date.now()
    let adapterResult: AdapterResult
    let panicked = false
    let panicError: string | undefined

    const timeoutController = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    if (opts.timeoutMs && opts.timeoutMs > 0) {
      timer = setTimeout(() => {
        timeoutController.abort()
        log('system', `Task timed out after ${opts.timeoutMs}ms`)
      }, opts.timeoutMs)
    }

    // Combine ctx.signal and timeoutController.signal
    const linkedController = new AbortController()
    const onParentAbort = () => linkedController.abort()
    const onTimeoutAbort = () => linkedController.abort()

    if (ctx.signal.aborted || timeoutController.signal.aborted) {
      linkedController.abort()
    } else {
      ctx.signal.addEventListener('abort', onParentAbort, { once: true })
      timeoutController.signal.addEventListener('abort', onTimeoutAbort, { once: true })
    }

    const sandboxedCtx: AdapterContext = {
      ...ctx,
      signal: linkedController.signal,
    }

    try {
      log('system', `Sandbox starting adapter: ${adapter.name}`)

      const executionPromise = (async () => {
        return await adapter.execute(sandboxedCtx)
      })()

      const timeoutPromise = new Promise<never>((_, reject) => {
        if (sandboxedCtx.signal.aborted) {
          if (timeoutController.signal.aborted) {
            reject(new Error(`Timeout: Adapter execution exceeded ${opts.timeoutMs}ms`))
          } else {
            reject(new Error('Cancelled: Execution aborted'))
          }
        } else {
          sandboxedCtx.signal.addEventListener(
            'abort',
            () => {
              if (timeoutController.signal.aborted) {
                reject(new Error(`Timeout: Adapter execution exceeded ${opts.timeoutMs}ms`))
              } else {
                reject(new Error('Cancelled: Execution aborted'))
              }
            },
            { once: true }
          )
        }
      })

      adapterResult = await Promise.race([executionPromise, timeoutPromise])
      log('system', `Sandbox adapter completed: success=${adapterResult.success}`)
    } catch (err) {
      panicked = true
      const errMsg = err instanceof Error ? err.message : String(err)
      panicError = errMsg
      log('stderr', `Sandbox caught error: ${errMsg}`)

      const isTimeout = timeoutController.signal.aborted
      const isCancelled = ctx.signal.aborted && !isTimeout

      adapterResult = {
        success: false,
        error: errMsg,
        failureCategory: isTimeout ? 'timeout' : isCancelled ? 'cancellation' : 'adapter_failure',
        durationMs: Date.now() - start,
      }
    } finally {
      if (timer) clearTimeout(timer)
      ctx.signal.removeEventListener('abort', onParentAbort)
      timeoutController.signal.removeEventListener('abort', onTimeoutAbort)

      // Guarantee cleanup and dispose never throw
      try {
        await adapter.cleanup()
      } catch (cleanupErr) {
        log('stderr', `Adapter cleanup failed: ${cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr)}`)
      }

      try {
        await adapter.dispose()
      } catch (disposeErr) {
        log('stderr', `Adapter dispose failed: ${disposeErr instanceof Error ? disposeErr.message : String(disposeErr)}`)
      }
    }

    return {
      adapterResult,
      logs,
      durationMs: Date.now() - start,
      panicked,
      panicError,
    }
  }
}
