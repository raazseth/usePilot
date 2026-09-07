# Retry Engine

The `RetryEngine` implements infrastructure-level retries without adapters needing bespoke retry logic.

## Configuration

Retry parameters originate from the planner in `Task['retryPolicy']`:
- `maxAttempts`: Maximum execution attempts (default: 1, max: 5).
- `backoffMs`: Base delay between attempts in milliseconds.
- `exponential`: Whether delay doubles on consecutive attempts (`delay * 2^(attempt - 1)`).

## Cooperative Cancellation

The retry loop checks `ctx.signal.aborted` before every attempt and during backoff delay. If cancelled, retry attempts abort immediately with `failureCategory: 'cancellation'`.
