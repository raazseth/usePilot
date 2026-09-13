import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { FindFilesSkill } from '../skills/filesystem/find-files'
import { OrganizeDownloadsSkill } from '../skills/filesystem/organize-downloads'
import type { Skill } from '@usepilot/skill-types'

describe('SkillRegistry', () => {
  let registry: SkillRegistry

  beforeEach(() => {
    registry = new SkillRegistry()
  })

  it('registers and retrieves a skill by id', () => {
    registry.register(FindFilesSkill)
    expect(registry.has(FindFilesSkill.id)).toBe(true)

    const resolved = registry.get(FindFilesSkill.id)
    expect(resolved).toBeDefined()
    expect(resolved?.name).toBe('Find Files')
  })

  it('rejects duplicate skill registration with same ID', () => {
    registry.register(FindFilesSkill)
    expect(() => registry.register(FindFilesSkill)).toThrowError(
      /already registered/i
    )
  })

  it('rejects skill with invalid or missing required properties', () => {
    const invalidSkill = {
      id: '',
      name: '',
      description: 'Missing id and name',
    } as unknown as Skill

    expect(() => registry.register(invalidSkill)).toThrowError(
      /Cannot register invalid Skill/i
    )
  })

  it('lists registered skills with category filtering', () => {
    registry.register(FindFilesSkill)
    registry.register(OrganizeDownloadsSkill)

    const all = registry.list()
    expect(all).toHaveLength(2)

    const fsSkills = registry.list('filesystem')
    expect(fsSkills).toHaveLength(2)

    const browserSkills = registry.list('browser')
    expect(browserSkills).toHaveLength(0)
  })

  it('unregisters a skill cleanly', () => {
    registry.register(FindFilesSkill)
    expect(registry.has(FindFilesSkill.id)).toBe(true)

    const removed = registry.unregister(FindFilesSkill.id)
    expect(removed).toBe(true)
    expect(registry.has(FindFilesSkill.id)).toBe(false)
    expect(registry.get(FindFilesSkill.id)).toBeUndefined()
  })

  it('checks availability against capability provider', () => {
    registry.register(FindFilesSkill)

    // Capability provider where search_files is present but read_file is missing
    const partialCapabilities = new Set(['search_files'])
    const availableState = registry.isAvailable(
      FindFilesSkill.id,
      (cap) => partialCapabilities.has(cap)
    )

    expect(availableState.available).toBe(false)
    expect(availableState.missingCapabilities).toContain('read_file')

    // Full capabilities
    const fullCapabilities = new Set(['search_files', 'read_file'])
    const fullState = registry.isAvailable(
      FindFilesSkill.id,
      (cap) => fullCapabilities.has(cap)
    )
    expect(fullState.available).toBe(true)
    expect(fullState.missingCapabilities).toHaveLength(0)
  })

  it('exports immutable manifests for registered skills', () => {
    registry.register(FindFilesSkill)
    const manifests = registry.getManifests()
    expect(manifests).toHaveLength(1)
    expect(manifests[0]?.id).toBe(FindFilesSkill.id)
    expect(manifests[0]?.riskLevel).toBe('low')
  })
})
