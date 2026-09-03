/**
 * Typed HTTP client for the Bun backend REST API.
 * Wraps fetch with base URL management and error handling.
 */
export class APIClient {
  private baseUrl: string

  constructor(port: number) {
    this.baseUrl = `http://localhost:${port}`
  }

  updatePort(port: number) {
    this.baseUrl = `http://localhost:${port}`
  }

  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new APIError(response.status, (error as { error: string }).error)
    }
    return response.json() as Promise<T>
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new APIError(response.status, (error as { error: string }).error)
    }
    return response.json() as Promise<T>
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }))
      throw new APIError(response.status, (error as { error: string }).error)
    }
    return response.json() as Promise<T>
  }

  async delete(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new APIError(response.status, response.statusText)
    }
  }
}

export class APIError extends Error {
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message)
    this.name = 'APIError'
  }

  isNotFound(): boolean {
    return this.status === 404
  }

  isServerError(): boolean {
    return this.status >= 500
  }
}

/** Singleton instance — port updated once backend connects */
export const apiClient = new APIClient(0)
