import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { SkillRegistry } from '../registry/skill-registry'
import { SkillDiscovery } from '../discovery/skill-discovery'
import { SkillResolver } from '../resolver/skill-resolver'
import { SkillWorkflowCompiler } from '../workflow/compiler'
import { SkillVerifier } from '../verification/skill-verifier'
import { BUILTIN_SKILLS } from '../skills/builtin'
import { createProductionRegistry, createExecutionRunner } from '@usepilot/execution-core'

describe('End-to-End Skill Pipeline', () => {
  const testDir = join(tmpdir(), `usepilot-skill-e2e-${Date.now()}`)

  let registry: SkillRegistry
  let discovery: SkillDiscovery
  let resolver: SkillResolver
  let compiler: SkillWorkflowCompiler
  let verifier: SkillVerifier

  beforeEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })

    registry = new SkillRegistry()
    for (const skill of BUILTIN_SKILLS) {
      registry.register(skill)
    }
    discovery = new SkillDiscovery(registry)
    resolver = new SkillResolver()
    compiler = new SkillWorkflowCompiler()
    verifier = new SkillVerifier()
  })

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
  })

  it('runs the complete User -> Discovery -> Resolver -> Planner -> Execution -> Verification pipeline for "Organize Downloads"', async () => {
    // 1. User Natural Language Request
    const userPrompt = 'Please organize my downloads folder'

    // 2. Skill Discovery
    const candidates = discovery.discover({ text: userPrompt })
    expect(candidates.length).toBeGreaterThan(0)
    const selectedCandidate = candidates[0]!
    expect(selectedCandidate.skillId).toBe('organize-downloads')

    const skill = registry.get(selectedCandidate.skillId)!
    expect(skill).toBeDefined()

    // 3. Skill Resolution (first check missing input)
    const initialResolution = resolver.resolve(skill, {})
    expect(initialResolution.status).toBe('missing_input')
    expect(initialResolution.missingInputs[0]?.name).toBe('folder')

    // Supply missing input (e.g. user answered the prompt question)
    const fullResolution = resolver.resolve(skill, {
      folder: testDir,
      groupBy: 'fileType',
    })
    expect(fullResolution.status).toBe('ready')

    // Populate test files in testDir
    writeFileSync(join(testDir, 'invoice.pdf'), 'PDF invoice test content')
    writeFileSync(join(testDir, 'photo.png'), 'PNG test content')

    // 4. Workflow Compilation & Blueprint Generation via Planner
    const { workflow, blueprint } = await compiler.compile(
      skill,
      fullResolution.configuredInputs
    )

    expect(workflow.skillId).toBe('organize-downloads')
    expect(blueprint.status).toBe('ready')
    expect(blueprint.tasks.length).toBe(3)

    // 5. Execution Engine Run
    const executionRegistry = createProductionRegistry()
    const { runner } = createExecutionRunner(
      'run-org-downloads',
      'trace-org-downloads',
      executionRegistry
    )

    const result = await runner.run('run-org-downloads', 'trace-org-downloads', blueprint)
    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(3)

    // 6. Post-execution Outcome Verification
    const verification = verifier.verify(skill, fullResolution.configuredInputs, result)
    expect(verification.verified).toBe(true)
    expect(verification.conditionResults.every((c) => c.passed)).toBe(true)
  })

  it('runs complete pipeline for "Find Files" skill', async () => {
    // 1. User Natural Language Request
    const userPrompt = 'Find all PDF files in this folder'

    // 2. Discovery
    const candidates = discovery.discover({ text: userPrompt })
    expect(candidates[0]?.skillId).toBe('find-files')

    const skill = registry.get('find-files')!

    // Setup sample files
    writeFileSync(join(testDir, 'contract.pdf'), 'legal document text')
    writeFileSync(join(testDir, 'notes.txt'), 'notes text')

    // 3. Resolution
    const res = resolver.resolve(skill, {
      directory: testDir,
      query: 'contract',
      extension: 'pdf',
    })
    expect(res.status).toBe('ready')

    // 4. Compile Workflow
    const { blueprint } = await compiler.compile(skill, res.configuredInputs)

    // 5. Execute Blueprint
    const executionRegistry = createProductionRegistry()
    const { runner } = createExecutionRunner(
      'run-find-files',
      'trace-find-files',
      executionRegistry
    )

    const result = await runner.run('run-find-files', 'trace-find-files', blueprint)
    expect(result.status).toBe('completed')
    expect(result.tasksCompleted).toBe(1)

    // 6. Verify Outcome
    const verification = verifier.verify(skill, res.configuredInputs, result)
    expect(verification.verified).toBe(true)
  })
})
