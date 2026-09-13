import { existsSync, rmSync, mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { SkillRegistry } from '../registry/skill-registry'
import { ComposedWorkflowOrchestrator } from '../composition/orchestrator'
import { BUILTIN_SKILLS } from '../skills/builtin'
import {
  AuditAndCleanDownloadsComposition,
  FindAndRenameComposition,
} from '../skills/builtin-compositions'
import { createDefaultRegistry } from '@usepilot/execution-core'
import type { StepCompletionEvent } from '@usepilot/skill-types'

describe('ComposedWorkflowOrchestrator', () => {
  const testDir = join(tmpdir(), `usepilot-orchestrator-${Date.now()}`)

  let registry: SkillRegistry
  let orchestrator: ComposedWorkflowOrchestrator

  beforeEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true })
    mkdirSync(testDir, { recursive: true })

    registry = new SkillRegistry()
    for (const skill of BUILTIN_SKILLS) {
      registry.register(skill)
    }
    orchestrator = new ComposedWorkflowOrchestrator(registry)
  })

  afterEach(() => {
    if (existsSync(testDir)) rmSync(testDir, { recursive: true, force: true })
  })

  it('executes audit-and-clean-downloads with real filesystem (duplicate-detection → organize-downloads)', async () => {
    // Populate test directory with files across types
    writeFileSync(join(testDir, 'report.pdf'), 'PDF content')
    writeFileSync(join(testDir, 'photo.png'), 'PNG content')
    writeFileSync(join(testDir, 'notes.txt'), 'text content')

    const events: StepCompletionEvent[] = []

    const receipt = await orchestrator.execute(
      AuditAndCleanDownloadsComposition,
      { folder: testDir, groupBy: 'extension' },
      {
        executionRegistry: createDefaultRegistry(), // stubs for filesystem to avoid actual moves
        onStepComplete: (e) => events.push(e),
      }
    )

    // Both steps should complete
    expect(receipt.status).toBe('completed')
    expect(receipt.compositionId).toBe('audit-and-clean-downloads')
    expect(receipt.stepReceipts).toHaveLength(2)

    const [detectReceipt, organizeReceipt] = receipt.stepReceipts
    expect(detectReceipt!.stepId).toBe('detect-duplicates')
    expect(detectReceipt!.skillId).toBe('duplicate-file-detection')
    expect(detectReceipt!.status).toBe('completed')

    expect(organizeReceipt!.stepId).toBe('organize-folder')
    expect(organizeReceipt!.skillId).toBe('organize-downloads')
    expect(organizeReceipt!.status).toBe('completed')

    // Total tasks = duplicate-detection (2) + organize-downloads (3) = 5
    expect(receipt.totalTasksExecuted).toBe(5)
    expect(receipt.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('fires onStepComplete callback once per step, in order', async () => {
    writeFileSync(join(testDir, 'doc.pdf'), 'pdf')

    const events: StepCompletionEvent[] = []

    await orchestrator.execute(
      AuditAndCleanDownloadsComposition,
      { folder: testDir },
      {
        executionRegistry: createDefaultRegistry(),
        onStepComplete: (e) => events.push(e),
      }
    )

    expect(events).toHaveLength(2)
    // Events should fire in order
    expect(events[0]!.stepIndex).toBe(0)
    expect(events[0]!.stepId).toBe('detect-duplicates')
    expect(events[0]!.totalSteps).toBe(2)
    expect(events[1]!.stepIndex).toBe(1)
    expect(events[1]!.stepId).toBe('organize-folder')
  })

  it('executes find-and-rename with real filesystem (find-files → bulk-rename-files)', async () => {
    // Create files to be discovered and renamed
    writeFileSync(join(testDir, 'Screenshot_001.png'), 'img')
    writeFileSync(join(testDir, 'Screenshot_002.png'), 'img')
    writeFileSync(join(testDir, 'Screenshot_003.png'), 'img')

    const receipt = await orchestrator.execute(
      FindAndRenameComposition,
      {
        folder: testDir,
        findPattern: '*.png',
        extension: 'png',
        renamePattern: 'Screenshot',
        replacement: 'Photo',
      },
      {
        executionRegistry: createDefaultRegistry(),
      }
    )

    expect(receipt.status).toBe('completed')
    expect(receipt.compositionId).toBe('find-and-rename')
    expect(receipt.stepReceipts).toHaveLength(2)

    const [findReceipt, renameReceipt] = receipt.stepReceipts
    expect(findReceipt!.stepId).toBe('find-targets')
    expect(findReceipt!.skillId).toBe('find-files')
    expect(findReceipt!.status).toBe('completed')

    expect(renameReceipt!.stepId).toBe('rename-targets')
    expect(renameReceipt!.skillId).toBe('bulk-rename-files')
    expect(renameReceipt!.status).toBe('completed')

    // find-files (1 task) + bulk-rename-files (2 tasks) = 3 total
    expect(receipt.totalTasksExecuted).toBe(3)
  })

  it('totalTasksExecuted equals sum of tasks across all steps', async () => {
    writeFileSync(join(testDir, 'a.txt'), 'a')

    const receipt = await orchestrator.execute(
      AuditAndCleanDownloadsComposition,
      { folder: testDir },
      { executionRegistry: createDefaultRegistry() }
    )

    // duplicate-detection has 2 tasks, organize-downloads has 3 tasks
    const expectedTotal = 2 + 3
    expect(receipt.totalTasksExecuted).toBe(expectedTotal)
  })

  it('returns validation error for a composition with an unknown skill (does not crash)', async () => {
    const badComposition = {
      id: 'bad-composition',
      name: 'Bad',
      description: 'Has unknown skill',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'totally-unknown-skill-zzz',
          inputBindings: { folder: { source: 'workflow_input', key: 'folder' } },
        },
      ],
    }

    const receipt = await orchestrator.execute(
      badComposition,
      { folder: testDir },
      { executionRegistry: createDefaultRegistry() }
    )

    expect(receipt.status).toBe('failed')
    expect(receipt.error).toMatch(/validation failed/i)
    expect(receipt.error).toContain('missing_skill')
    expect(receipt.stepReceipts).toHaveLength(0)
    expect(receipt.totalTasksExecuted).toBe(0)
  })

  it('returns validation error for a composition with a forward-reference binding (does not crash)', async () => {
    const forwardRefComposition = {
      id: 'forward-ref-comp',
      name: 'Forward Ref',
      description: 'Has forward reference',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'find-files',
          inputBindings: {
            directory: '$steps.step-2.folder', // references future step
          },
        },
        {
          stepId: 'step-2',
          skillId: 'organize-downloads',
          inputBindings: {
            folder: { source: 'workflow_input', key: 'folder' },
          },
        },
      ],
    }

    const receipt = await orchestrator.execute(
      forwardRefComposition,
      { folder: testDir },
      { executionRegistry: createDefaultRegistry() }
    )

    expect(receipt.status).toBe('failed')
    expect(receipt.error).toMatch(/validation failed/i)
    expect(receipt.totalTasksExecuted).toBe(0)
  })

  it('outputs from step 1 are available in step 2 via $steps reference', async () => {
    writeFileSync(join(testDir, 'file.txt'), 'content')

    // Compose using $steps.step-1.<key> — step 2 reads the folder from step 1's recorded outputs
    const stepOutputComposition = {
      id: 'step-output-test',
      name: 'Step Output Test',
      description: 'Step 2 reads step 1 output via $steps reference',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'find-files',
          inputBindings: {
            directory: { source: 'workflow_input', key: 'folder' },
          },
        },
        {
          stepId: 'step-2',
          skillId: 'organize-downloads',
          inputBindings: {
            // Read 'folder' from step-1's recorded outputs (which includes its configuredInputs)
            folder: '$steps.step-1.directory',
          },
        },
      ],
    }

    const receipt = await orchestrator.execute(
      stepOutputComposition,
      { folder: testDir },
      { executionRegistry: createDefaultRegistry() }
    )

    expect(receipt.status).toBe('completed')
    expect(receipt.stepReceipts).toHaveLength(2)
    // Step 2's outputs should have folder resolved from step 1
    const step2Receipt = receipt.stepReceipts[1]!
    expect(step2Receipt.status).toBe('completed')
    expect(step2Receipt.outputs['folder']).toBe(testDir)
  })
})
