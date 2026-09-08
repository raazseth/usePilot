import { existsSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { SecretVault } from '../security/vault'

describe('SecretVault', () => {
  const testDir = join(tmpdir(), `usepilot-vault-test-${Date.now()}`)
  const storagePath = join(testDir, 'vault.enc')

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('stores and retrieves secrets encrypted with AES-256-GCM', () => {
    const vault = new SecretVault({ storagePath, masterPassword: 'super-secret-password-123' })
    vault.setSecret('amazon_gst_password', 'MyPassword!456')
    vault.setSecret('session_cookie', 'session_id=abcdef123456')

    expect(vault.getSecret('amazon_gst_password')).toBe('MyPassword!456')
    expect(vault.getSecret('session_cookie')).toBe('session_id=abcdef123456')
    expect(vault.hasSecret('amazon_gst_password')).toBe(true)
    expect(vault.hasSecret('non_existent')).toBe(false)
  })

  it('never stores plaintext on disk', () => {
    const vault = new SecretVault({ storagePath, masterPassword: 'super-secret-password-123' })
    const secretValue = 'VERY_SECRET_KEY_NEVER_PLAINTEXT'
    vault.setSecret('api_token', secretValue)

    const rawFile = readFileSync(storagePath, 'utf8')
    expect(rawFile.includes(secretValue)).toBe(false)
    expect(rawFile.includes('iv')).toBe(true)
    expect(rawFile.includes('tag')).toBe(true)
    expect(rawFile.includes('ciphertext')).toBe(true)
  })

  it('persists and reloads secrets across vault instances with matching key', () => {
    const vault1 = new SecretVault({ storagePath, masterPassword: 'persistent-key-789' })
    vault1.setSecret('flight_api_key', 'FLIGHT-XYZ-999')

    const vault2 = new SecretVault({ storagePath, masterPassword: 'persistent-key-789' })
    expect(vault2.getSecret('flight_api_key')).toBe('FLIGHT-XYZ-999')
  })

  it('deletes secrets cleanly and lists remaining keys', () => {
    const vault = new SecretVault({ storagePath, masterPassword: 'test-pass' })
    vault.setSecret('k1', 'v1')
    vault.setSecret('k2', 'v2')

    expect(vault.listKeys()).toEqual(['k1', 'k2'])
    expect(vault.deleteSecret('k1')).toBe(true)
    expect(vault.getSecret('k1')).toBeUndefined()
    expect(vault.listKeys()).toEqual(['k2'])
  })
})
