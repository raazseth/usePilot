// Result<T, E> — explicit error handling without exceptions

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E = Error> = Ok<T> | Err<E>

/** Create a successful Result */
export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

/** Create a failed Result */
export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

/** Type guard for Ok */
export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

/** Type guard for Err */
export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}
