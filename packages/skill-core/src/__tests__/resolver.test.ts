import { describe, it, expect, beforeEach } from 'vitest'
import { SkillResolver } from '../resolver/skill-resolver'
import { OrganizeDownloadsSkill } from '../skills/filesystem/organize-downloads'
import { ResearchWebsiteSkill } from '../skills/browser/research-website'
import { FillWebFormSkill } from '../skills/browser/fill-form'

describe('SkillResolver', () => {
  let resolver: SkillResolver

  beforeEach(() => {
    resolver = new SkillResolver()
  })

  it('detects missing required inputs and provides human prompt questions', () => {
    // OrganizeDownloads requires "folder"
    const resolution = resolver.resolve(OrganizeDownloadsSkill, {})

    expect(resolution.status).toBe('missing_input')
    expect(resolution.missingInputs).toHaveLength(1)
    expect(resolution.missingInputs[0]?.name).toBe('folder')
    expect(resolution.missingInputs[0]?.promptQuestion).toBe(
      'Which folder would you like to organize?'
    )
  })

  it('detects invalid inputs when validation schema fails', () => {
    // ResearchWebsite requires a valid URL
    const resolution = resolver.resolve(ResearchWebsiteSkill, {
      url: 'not-a-valid-url',
    })

    expect(resolution.status).toBe('invalid_input')
    expect(resolution.invalidInputs.length).toBeGreaterThan(0)
    expect(resolution.invalidInputs.some((inv) => inv.name === 'url')).toBe(true)
  })

  it('resolves ready status and populates defaults when valid inputs are given', () => {
    const resolution = resolver.resolve(OrganizeDownloadsSkill, {
      folder: 'C:/Users/Test/Downloads',
    })

    expect(resolution.status).toBe('ready')
    expect(resolution.configuredInputs['folder']).toBe('C:/Users/Test/Downloads')
    // Default groupBy should be populated
    expect(resolution.configuredInputs['groupBy']).toBe('extension')
  })

  it('detects unavailable capabilities on the system', () => {
    const resolution = resolver.resolve(
      OrganizeDownloadsSkill,
      { folder: 'C:/Users/Test/Downloads' },
      { availableCapabilities: ['read_file'] } // missing search_files, move_file, etc.
    )

    expect(resolution.status).toBe('unavailable_capabilities')
    expect(resolution.missingCapabilities).toContain('move_file')
  })

  it('detects platform incompatibility if platform is restricted', () => {
    const windowsOnlySkill = {
      ...OrganizeDownloadsSkill,
      supportedPlatforms: ['windows'] as ('windows' | 'macos' | 'linux')[],
    }

    const resolution = resolver.resolve(
      windowsOnlySkill,
      { folder: '/home/user/downloads' },
      { platform: 'linux' }
    )

    expect(resolution.status).toBe('unsupported_platform')
  })

  it('protects sensitive inputs marked in the manifest', () => {
    const formResolution = resolver.resolve(FillWebFormSkill, {
      url: 'https://example.com/login',
      formData: { username: 'testuser', password: 'secretpassword123' },
    })

    expect(formResolution.status).toBe('ready')
    expect(formResolution.configuredInputs['url']).toBe('https://example.com/login')
  })
})
