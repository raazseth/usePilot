import { nanoid, customAlphabet } from 'nanoid'

const shortAlphabet = '0123456789abcdefghijklmnopqrstuvwxyz'
const generateShortNanoid = customAlphabet(shortAlphabet, 12)

/**
 * Generate a collision-resistant unique ID.
 * Uses nanoid (21 chars, URL-safe alphabet).
 */
export function generateId(): string {
  return nanoid()
}

/**
 * Generate a short human-readable ID.
 * Uses a 12-char lowercase alphanumeric ID.
 * Lower collision resistance than generateId — use for display purposes only.
 */
export function generateShortId(): string {
  return generateShortNanoid()
}
