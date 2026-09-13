import { describe, it, expect } from 'vitest'
import { SkillWorkflowCompiler } from '../workflow/compiler'
import { OrganizeDownloadsSkill } from '../skills/filesystem/organize-downloads'
import { FillWebFormSkill } from '../skills/browser/fill-form'
import { FindFilesSkill } from '../skills/filesystem/find-files'

describe('SkillWorkflowCompiler', () => {
  const compiler = new SkillWorkflowCompiler()

  it('compiles a skill and verified inputs into Workflow and ExecutionBlueprint', async () => {
    const { workflow, blueprint } = await compiler.compile(
      OrganizeDownloadsSkill,
      {
        folder: 'C:/Test/Downloads',
        groupBy: 'fileType',
      }
    )

    expect(workflow.id).toBeDefined()
    expect(workflow.skillId).toBe(OrganizeDownloadsSkill.id)
    expect(workflow.tasks.length).toBeGreaterThan(0)

    // Blueprint checks
    expect(blueprint.id).toBeDefined()
    expect(blueprint.hash).toBeDefined()
    expect(blueprint.tasks.length).toBe(workflow.tasks.length)
    expect(blueprint.graph.nodes.length).toBe(workflow.tasks.length)
    expect(blueprint.graph.taskCount).toBe(workflow.tasks.length)
    expect(blueprint.graph.depth).toBeGreaterThan(0)
    expect(blueprint.successCriteria.length).toBeGreaterThan(0)
  })

  it('enforces mandatory human approval policy on consequential submission tasks', async () => {
    const { workflow, blueprint } = await compiler.compile(
      FillWebFormSkill,
      {
        url: 'https://example.com/form',
        formData: { email: 'user@example.com' },
        submitAfterFill: true,
      }
    )

    // Find submit task
    const submitTask = workflow.tasks.find((t) => t.id.includes('submit-form-button'))
    expect(submitTask).toBeDefined()
    expect(submitTask?.approvalPolicy).toBe('mandatory')

    // Invariant 6: Blueprint must reflect mandatory approval requirements
    expect(blueprint.approvals.requiresMandatoryApproval).toBe(true)
    expect(blueprint.approvals.mandatoryTaskIds.length).toBeGreaterThan(0)
  })

  it('maps DAG dependencies correctly according to template specifications', async () => {
    const { blueprint } = await compiler.compile(
      OrganizeDownloadsSkill,
      {
        folder: 'C:/Test/Downloads',
        groupBy: 'extension',
      }
    )

    // OrganizeDownloads has inspect -> create folders -> move files
    expect(blueprint.tasks.length).toBe(3)
    const scanTask = blueprint.tasks.find((t) => t.id.includes('inspect-folder'))
    const createFolderTask = blueprint.tasks.find((t) => t.id.includes('create-category-folders'))
    const moveTask = blueprint.tasks.find((t) => t.id.includes('move-files-to-categories'))

    expect(scanTask).toBeDefined()
    expect(createFolderTask).toBeDefined()
    expect(moveTask).toBeDefined()
    expect(createFolderTask?.dependsOn).toContain(scanTask?.id)
    expect(moveTask?.dependsOn).toContain(createFolderTask?.id)
  })
})
