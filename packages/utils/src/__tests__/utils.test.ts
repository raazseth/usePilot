import { describe, it, expect } from 'vitest'
import { generateId, generateShortId } from '../id'
import { truncate, capitalize, slugify } from '../string'
import { ok, err, isOk, isErr } from '../result'

describe('id utils', () => {
  it('generates unique 21-char ids', () => {
    const id1 = generateId()
    const id2 = generateId()
    expect(id1).not.toBe(id2)
    expect(id1.length).toBe(21)
  })

  it('generates short 12-char ids', () => {
    const id = generateShortId()
    expect(id.length).toBe(12)
  })
})

describe('string utils', () => {
  it('truncates long strings with ellipsis', () => {
    expect(truncate('Hello world, this is a test string', 12)).toBe('Hello wor...')
    expect(truncate('Short', 10)).toBe('Short')
  })

  it('capitalizes first letter', () => {
    expect(capitalize('hello')).toBe('Hello')
    expect(capitalize('')).toBe('')
  })

  it('creates url-safe slug', () => {
    expect(slugify('Hello World!')).toBe('hello-world')
    expect(slugify('  usePilot -- AI Assistant ')).toBe('usepilot-ai-assistant')
  })
})

describe('result utils', () => {
  it('handles ok result', () => {
    const r = ok(42)
    expect(isOk(r)).toBe(true)
    expect(isErr(r)).toBe(false)
    if (isOk(r)) {
      expect(r.value).toBe(42)
    }
  })

  it('handles err result', () => {
    const r = err('something broke')
    expect(isOk(r)).toBe(false)
    expect(isErr(r)).toBe(true)
    if (isErr(r)) {
      expect(r.error).toBe('something broke')
    }
  })
})
