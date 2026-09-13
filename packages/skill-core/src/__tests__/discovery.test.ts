import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { SkillDiscovery } from '../discovery/skill-discovery'
import { BUILTIN_SKILLS } from '../skills/builtin'

describe('SkillDiscovery', () => {
  let registry: SkillRegistry
  let discovery: SkillDiscovery

  beforeEach(() => {
    registry = new SkillRegistry()
    for (const skill of BUILTIN_SKILLS) {
      registry.register(skill)
    }
    discovery = new SkillDiscovery(registry)
  })

  it('discovers OrganizeDownloadsSkill for "organize my downloads by file type"', () => {
    const candidates = discovery.discover({
      text: 'Organize my Downloads folder by file extension',
    })

    expect(candidates.length).toBeGreaterThan(0)
    const top = candidates[0]
    expect(top?.skillId).toBe('organize-downloads')
    expect(top?.score).toBeGreaterThan(0.6)
    expect(top?.reasons.length).toBeGreaterThan(0)
  })

  it('discovers FindFilesSkill for "find all PDFs containing invoice"', () => {
    const candidates = discovery.discover({
      text: 'Find all PDF documents containing invoice in my Documents',
    })

    expect(candidates.length).toBeGreaterThan(0)
    const top = candidates[0]
    expect(top?.skillId).toBe('find-files')
    expect(top?.score).toBeGreaterThan(0.5)
  })

  it('discovers ResearchWebsiteSkill for "research this company website"', () => {
    const candidates = discovery.discover({
      text: 'Research this company website and summarize their products',
    })

    expect(candidates.length).toBeGreaterThan(0)
    const top = candidates[0]
    expect(top?.skillId).toBe('research-website')
  })

  it('discovers FillWebFormSkill for "fill out the application form"', () => {
    const candidates = discovery.discover({
      text: 'Fill this job application form with my details',
    })

    expect(candidates.length).toBeGreaterThan(0)
    const top = candidates[0]
    expect(top?.skillId).toBe('fill-web-form')
  })

  it('filters candidates by category when requested', () => {
    const candidates = discovery.discover({
      text: 'download reports',
      category: 'browser',
    })

    expect(candidates.every((c) => {
      const skill = registry.get(c.skillId)
      return skill?.category === 'browser'
    })).toBe(true)
  })

  it('identifies unavailable capabilities in candidates', () => {
    // Discovery with restricted capabilities
    const restrictedDiscovery = new SkillDiscovery(registry, {
      capabilityProvider: (cap) => cap === 'read_file', // missing move_file, write_file, etc.
    })

    const candidates = restrictedDiscovery.discover({
      text: 'organize downloads',
    })

    const organizeCandidate = candidates.find((c) => c.skillId === 'organize-downloads')
    expect(organizeCandidate).toBeDefined()
    expect(organizeCandidate?.unavailableCapabilities.length).toBeGreaterThan(0)
  })

  it('handles completely unrelated queries gracefully without crashing', () => {
    const candidates = discovery.discover({
      text: 'xyz123 random meaningless string completely unrelated to any skill',
    })

    // Scores should be 0 or empty list
    expect(candidates.length).toBe(0)
  })
})
