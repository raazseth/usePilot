// Primitive type aliases used throughout the codebase
// These exist to communicate intent, not just structure

/** Nanoid-generated string identifier */
export type ID = string

/** Unix timestamp in milliseconds */
export type Timestamp = number

/** T or null */
export type Nullable<T> = T | null

/** T or undefined */
export type Optional<T> = T | undefined

/** A record with string keys — loosely typed for event payload compatibility */
export type JsonRecord = Record<string, unknown>

/** JSON-serializable value */
export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

