// ─────────────────────────────────────────────────────────────────────────────
// AI Provider Error Types
// ─────────────────────────────────────────────────────────────────────────────

export enum AIProviderErrorCode {
  /** Provider is not reachable */
  Unavailable = 'PROVIDER_UNAVAILABLE',
  /** The requested model does not exist */
  ModelNotFound = 'MODEL_NOT_FOUND',
  /** Request was cancelled by the caller */
  Aborted = 'REQUEST_ABORTED',
  /** Request timed out */
  Timeout = 'REQUEST_TIMEOUT',
  /** Provider returned an unexpected response format */
  InvalidResponse = 'INVALID_RESPONSE',
  /** Authentication failure (invalid API key) */
  AuthenticationFailed = 'AUTHENTICATION_FAILED',
  /** Rate limited by the provider */
  RateLimited = 'RATE_LIMITED',
  /** Unexpected error */
  Unknown = 'UNKNOWN',
}

export class AIProviderError extends Error {
  readonly code: AIProviderErrorCode
  readonly provider: string
  override readonly cause?: unknown

  constructor(options: {
    message: string
    code: AIProviderErrorCode
    provider: string
    cause?: unknown
  }) {
    super(options.message, { cause: options.cause })
    this.name = 'AIProviderError'
    this.code = options.code
    this.provider = options.provider
    this.cause = options.cause
  }

  static unavailable(provider: string, cause?: unknown): AIProviderError {
    return new AIProviderError({
      message: `${provider} is not available. Make sure it is running.`,
      code: AIProviderErrorCode.Unavailable,
      provider,
      cause,
    })
  }

  static modelNotFound(provider: string, model: string): AIProviderError {
    return new AIProviderError({
      message: `Model "${model}" was not found in ${provider}.`,
      code: AIProviderErrorCode.ModelNotFound,
      provider,
    })
  }

  static aborted(provider: string): AIProviderError {
    return new AIProviderError({
      message: `Request to ${provider} was cancelled.`,
      code: AIProviderErrorCode.Aborted,
      provider,
    })
  }

  static timeout(provider: string, timeoutMs: number): AIProviderError {
    return new AIProviderError({
      message: `Request to ${provider} timed out after ${timeoutMs}ms.`,
      code: AIProviderErrorCode.Timeout,
      provider,
    })
  }

  static invalidResponse(provider: string, cause?: unknown): AIProviderError {
    return new AIProviderError({
      message: `${provider} returned an unexpected response format.`,
      code: AIProviderErrorCode.InvalidResponse,
      provider,
      cause,
    })
  }

  static authFailed(provider: string): AIProviderError {
    return new AIProviderError({
      message: `Authentication failed for ${provider}. Check your API key.`,
      code: AIProviderErrorCode.AuthenticationFailed,
      provider,
    })
  }

  isRetryable(): boolean {
    return (
      this.code === AIProviderErrorCode.Unavailable ||
      this.code === AIProviderErrorCode.Timeout ||
      this.code === AIProviderErrorCode.RateLimited
    )
  }
}
