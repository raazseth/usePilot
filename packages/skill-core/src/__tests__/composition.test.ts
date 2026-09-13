import { describe, it, expect } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { SkillComposer } from '../composition/composer'
import { BUILTIN_SKILLS } from '../skills/builtin'
import { ResearchDownloadAndOrganizeComposition } from '../skills/builtin-compositions'
import type { SkillComposition } from '@usepilot/skill-types'

describe('SkillComposer', () => {
  const registry = new SkillRegistry()
  for (const s of BUILTIN_SKILLS) {
    registry.register(s)
  }
  const composer = new SkillComposer(registry)

  it('composes a two-step skill chain with explicit input-output bindings', async () => {
    // Step 1: Research Website
    // Step 2: Extract Website Data
    const composition: SkillComposition = {
      id: 'research-and-extract-pipeline',
      name: 'Research and Extract Pipeline',
      description: 'Research website and extract specific structured fields from the page',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1-research',
          skillId: 'research-website',
          inputBindings: {
            url: { source: 'workflow_input', key: 'targetUrl' },
            topic: { source: 'workflow_input', key: 'researchTopic' },
          },
        },
        {
          stepId: 'step-2-extract',
          skillId: 'extract-website-data',
          inputBindings: {
            url: { source: 'workflow_input', key: 'targetUrl' },
            fields: { source: 'workflow_input', key: 'targetFields' },
          },
        },
      ],
    }

    const { workflow, blueprint } = await composer.compose(composition, {
      targetUrl: 'https://docs.usepilot.dev',
      researchTopic: 'architecture',
      targetFields: ['modules', 'interfaces'],
    })

    expect(workflow.id).toBeDefined()
    expect(workflow.tasks.length).toBeGreaterThan(3)
    expect(blueprint.tasks.length).toBe(workflow.tasks.length)

    // Step 2 tasks should depend on the final task of Step 1
    const step1Tasks = workflow.tasks.filter((t) => t.id.includes('step-1-research'))
    const step2Tasks = workflow.tasks.filter((t) => t.id.includes('step-2-extract'))

    expect(step1Tasks.length).toBeGreaterThan(0)
    expect(step2Tasks.length).toBeGreaterThan(0)

    const firstStep2Task = step2Tasks[0]
    const lastStep1Task = step1Tasks[step1Tasks.length - 1]

    expect(firstStep2Task?.dependsOn).toContain(lastStep1Task?.id)
  })

  it('rejects composition when referenced skill does not exist', async () => {
    const brokenComposition: SkillComposition = {
      id: 'invalid-comp',
      name: 'Invalid Comp',
      description: 'Contains non-existent skill',
      version: '1.0.0',
      steps: [
        {
          stepId: 'missing-step',
          skillId: 'non-existent-skill-id',
          inputBindings: {},
        },
      ],
    }

    await expect(composer.compose(brokenComposition, {})).rejects.toThrowError(
      /skill "non-existent-skill-id" not found/i
    )
  })

  it('compiles research-download-and-organize builtin composition with tasks from all 3 steps in dependency order', async () => {
    // research-website (2 tasks) → download-documents (2 tasks) → organize-downloads (3 tasks) = 7 total
    const { workflow, blueprint } = await composer.compose(
      ResearchDownloadAndOrganizeComposition,
      {
        url: 'https://docs.usepilot.dev',
        topic: 'architecture',
        destinationFolder: '/tmp/test-reports',
        fileExtension: '.pdf',
        groupBy: 'extension',
      }
    )

    expect(workflow.tasks.length).toBe(7)
    expect(blueprint.tasks.length).toBe(7)

    // Identify tasks by step prefix
    const step1Tasks = workflow.tasks.filter((t) => t.id.includes('research-page'))
    const step2Tasks = workflow.tasks.filter((t) => t.id.includes('download-docs'))
    const step3Tasks = workflow.tasks.filter((t) => t.id.includes('organize-docs'))

    expect(step1Tasks.length).toBe(2) // research-website has 2 tasks
    expect(step2Tasks.length).toBe(2) // download-documents has 2 tasks
    expect(step3Tasks.length).toBe(3) // organize-downloads has 3 tasks

    // First task of step 2 must depend on last task of step 1
    const lastStep1Task = step1Tasks[step1Tasks.length - 1]!
    const firstStep2Task = step2Tasks[0]!
    expect(firstStep2Task.dependsOn).toContain(lastStep1Task.id)

    // First task of step 3 must depend on last task of step 2
    const lastStep2Task = step2Tasks[step2Tasks.length - 1]!
    const firstStep3Task = step3Tasks[0]!
    expect(firstStep3Task.dependsOn).toContain(lastStep2Task.id)
  })
})
