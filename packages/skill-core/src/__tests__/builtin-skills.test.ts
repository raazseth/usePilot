import { describe, it, expect } from 'vitest'
import { BUILTIN_SKILLS } from '../skills/builtin'
import { SkillRegistry } from '../registry/skill-registry'
import { SkillResolver } from '../resolver/skill-resolver'
import { SkillWorkflowCompiler } from '../workflow/compiler'

describe('Built-in Skills Comprehensive Suite', () => {
  const registry = new SkillRegistry()
  const resolver = new SkillResolver()
  const compiler = new SkillWorkflowCompiler()

  for (const skill of BUILTIN_SKILLS) {
    registry.register(skill)
  }

  it('contains exactly 10 initial built-in production skills', () => {
    expect(BUILTIN_SKILLS.length).toBe(10)
  })

  it('registers all 10 skills in registry with zero errors', () => {
    expect(registry.list().length).toBe(10)
  })

  // Test 1: Find Files Skill
  it('Skill 1: Find Files validates and compiles', async () => {
    const skill = registry.get('find-files')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, { directory: 'C:/Docs', query: 'invoice' })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBeGreaterThan(0)
  })

  // Test 2: Organize Downloads Skill
  it('Skill 2: Organize Downloads validates and compiles', async () => {
    const skill = registry.get('organize-downloads')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, { folder: 'C:/Users/Test/Downloads' })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(3)
  })

  // Test 3: Bulk Rename Files Skill
  it('Skill 3: Bulk Rename Files validates and compiles', async () => {
    const skill = registry.get('bulk-rename-files')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      folder: 'C:/Screenshots',
      pattern: 'screenshot-*.png',
      replacementTemplate: 'screen_{date}_{index}.png',
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(2)
  })

  // Test 4: Duplicate Detection Skill
  it('Skill 4: Duplicate Detection validates and compiles', async () => {
    const skill = registry.get('duplicate-file-detection')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, { folder: 'C:/Downloads' })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(2)
  })

  // Test 5: Research Website Skill
  it('Skill 5: Research Website validates and compiles', async () => {
    const skill = registry.get('research-website')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://docs.usepilot.dev',
      topic: 'architecture',
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(2)
  })

  // Test 6: Extract Website Data Skill
  it('Skill 6: Extract Website Data validates and compiles', async () => {
    const skill = registry.get('extract-website-data')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://store.example.com',
      fields: ['productName', 'price'],
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(2)
  })

  // Test 7: Download Documents Skill
  it('Skill 7: Download Documents validates and compiles', async () => {
    const skill = registry.get('download-documents')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://company.org/investors',
      targetDirectory: 'C:/Financials',
      fileExtension: '.pdf',
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(2)
  })

  // Test 8: Fill Web Form Skill
  it('Skill 8: Fill Web Form validates and compiles with safety', async () => {
    const skill = registry.get('fill-web-form')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://service.com/contact',
      formData: { message: 'Hello usePilot team' },
      submitAfterFill: true,
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.approvals.requiresMandatoryApproval).toBe(true)
  })

  // Test 9: Download and Organize Skill (Cross-runtime)
  it('Skill 9: Download and Organize (Cross-Runtime) validates and compiles', async () => {
    const skill = registry.get('download-and-organize')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://reports.org/data',
      destinationFolder: 'C:/Finance/Reports',
      fileExtension: '.pdf',
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(4)
    // Combines browser and filesystem capabilities
    expect(skill.requiredCapabilities).toContain('download_file')
    expect(skill.requiredCapabilities).toContain('move_file')
  })

  // Test 10: Research and Save Report Skill (Cross-runtime)
  it('Skill 10: Research and Save Report (Cross-Runtime) validates and compiles', async () => {
    const skill = registry.get('research-and-save-report')!
    expect(skill).toBeDefined()
    const res = resolver.resolve(skill, {
      url: 'https://ai.news.com',
      topic: 'AGI developments',
      outputFilePath: 'C:/Research/report.md',
    })
    expect(res.status).toBe('ready')
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)
    expect(blueprint.tasks.length).toBe(3)
    // Combines browser, extraction and filesystem write
    expect(skill.requiredCapabilities).toContain('navigate_website')
    expect(skill.requiredCapabilities).toContain('write_file')
  })
})
