import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { PermissionManager } from '../security/permissions'

describe('PermissionManager', () => {
  const testDir = join(tmpdir(), `usepilot-perm-test-${Date.now()}`)
  const storagePath = join(testDir, 'grants.json')

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

  it('correctly maps TaskCapability to PermissionResource', () => {
    const manager = new PermissionManager({ storagePath })
    expect(manager.mapCapabilityToResource('navigate_website')).toBe('browser')
    expect(manager.mapCapabilityToResource('download_file')).toBe('browser')
    expect(manager.mapCapabilityToResource('read_file')).toBe('filesystem:read')
    expect(manager.mapCapabilityToResource('write_file')).toBe('filesystem:write')
    expect(manager.mapCapabilityToResource('read_clipboard')).toBe('clipboard:read')
    expect(manager.mapCapabilityToResource('write_clipboard')).toBe('clipboard:write')
    expect(manager.mapCapabilityToResource('execute_command')).toBe('desktop:launch')
    expect(manager.mapCapabilityToResource('none')).toBeUndefined()
  })

  it('handles once scope permissions (consumed on first check)', () => {
    const manager = new PermissionManager({ storagePath })
    manager.grant('filesystem:write', 'once')

    expect(manager.hasPermission('filesystem:write')).toBe(true)
    // Second check should return false since it was consumed
    expect(manager.hasPermission('filesystem:write')).toBe(false)
  })

  it('handles session scope permissions (persists in-memory until reset)', () => {
    const manager = new PermissionManager({ storagePath })
    manager.grant('browser', 'session')

    expect(manager.hasPermission('browser')).toBe(true)
    expect(manager.hasPermission('browser')).toBe(true)

    manager.resetSession()
    expect(manager.hasPermission('browser')).toBe(false)
  })

  it('handles always scope permissions (persists across manager instances on disk)', () => {
    const manager1 = new PermissionManager({ storagePath })
    manager1.grant('clipboard:read', 'always')

    const manager2 = new PermissionManager({ storagePath })
    expect(manager2.hasPermission('clipboard:read')).toBe(true)

    manager2.revoke('clipboard:read')
    expect(manager2.hasPermission('clipboard:read')).toBe(false)

    const manager3 = new PermissionManager({ storagePath })
    expect(manager3.hasPermission('clipboard:read')).toBe(false)
  })
})
