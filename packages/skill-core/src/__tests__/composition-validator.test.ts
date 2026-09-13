import { describe, it, expect, beforeEach } from 'vitest'
import { SkillRegistry } from '../registry/skill-registry'
import { CompositionValidator } from '../composition/composition-validator'
import { BUILTIN_SKILLS } from '../skills/builtin'
import type { SkillComposition } from '@usepilot/skill-types'

describe('CompositionValidator', () => {
  let registry: SkillRegistry
  let validator: CompositionValidator

  beforeEach(() => {
    registry = new SkillRegistry()
    for (const skill of BUILTIN_SKILLS) {
      registry.register(skill)
    }
    validator = new CompositionValidator(registry)
  })

  it('accepts a valid 2-step composition', () => {
    const composition: SkillComposition = {
      id: 'valid-2-step',
      name: 'Valid 2 Step',
      description: 'Find then rename',
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
          skillId: 'bulk-rename-files',
          inputBindings: {
            folder: { source: 'workflow_input', key: 'folder' },
            pattern: { source: 'workflow_input', key: 'pattern' },
          },
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('accepts the audit-and-clean-downloads builtin composition', () => {
    const composition: SkillComposition = {
      id: 'audit-and-clean-downloads',
      name: 'Audit and Clean Downloads',
      description: 'Scan for duplicates then organize',
      version: '1.0.0',
      steps: [
        {
          stepId: 'detect-duplicates',
          skillId: 'duplicate-file-detection',
          inputBindings: {
            folder: { source: 'workflow_input', key: 'folder' },
          },
        },
        {
          stepId: 'organize-folder',
          skillId: 'organize-downloads',
          inputBindings: {
            folder: { source: 'workflow_input', key: 'folder' },
          },
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a composition with an unknown skill ID', () => {
    const composition: SkillComposition = {
      id: 'invalid-unknown-skill',
      name: 'Invalid',
      description: 'Has unknown skill',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'non-existent-skill-xyz',
          inputBindings: {},
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(false)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]!.type).toBe('missing_skill')
    expect(result.errors[0]!.detail).toContain('non-existent-skill-xyz')
  })

  it('rejects a composition with duplicate step IDs', () => {
    const composition: SkillComposition = {
      id: 'invalid-duplicate-steps',
      name: 'Duplicate Steps',
      description: 'Has duplicate step ID',
      version: '1.0.0',
      steps: [
        {
          stepId: 'same-id',
          skillId: 'find-files',
          inputBindings: { directory: { source: 'workflow_input', key: 'folder' } },
        },
        {
          stepId: 'same-id', // duplicate
          skillId: 'organize-downloads',
          inputBindings: { folder: { source: 'workflow_input', key: 'folder' } },
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(false)
    const dupError = result.errors.find((e) => e.type === 'duplicate_step_id')
    expect(dupError).toBeDefined()
    expect(dupError!.stepId).toBe('same-id')
  })

  it('rejects a composition where step 1 references step 2 output (forward reference)', () => {
    const composition: SkillComposition = {
      id: 'invalid-forward-ref',
      name: 'Forward Reference',
      description: 'Step 1 tries to use step 2 output',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'find-files',
          inputBindings: {
            // step-1 references step-2 which hasn't run yet — forward reference
            directory: '$steps.step-2.folder',
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

    const result = validator.validate(composition)
    expect(result.valid).toBe(false)
    const fwdError = result.errors.find((e) => e.type === 'forward_reference')
    expect(fwdError).toBeDefined()
    expect(fwdError!.stepId).toBe('step-1')
    expect(fwdError!.detail).toContain('step-2')
  })

  it('accepts a backward $steps reference (step 2 uses step 1 output)', () => {
    const composition: SkillComposition = {
      id: 'valid-backward-ref',
      name: 'Valid Backward Ref',
      description: 'Step 2 uses step 1 output — valid',
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
            // Backward reference — step-2 uses step-1's output
            folder: '$steps.step-1.directory',
          },
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a composition with a binding referencing an unknown step ID', () => {
    const composition: SkillComposition = {
      id: 'invalid-unknown-step-ref',
      name: 'Unknown Step Ref',
      description: 'References a step that does not exist',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'find-files',
          inputBindings: {
            directory: '$steps.phantom-step.folder', // phantom-step does not exist
          },
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(false)
    // Either forward_reference or unresolvable_binding — both are valid error types for this
    const hasError = result.errors.some(
      (e) => e.type === 'unresolvable_binding' || e.type === 'forward_reference'
    )
    expect(hasError).toBe(true)
  })

  it('collects multiple errors in a single validation call', () => {
    const composition: SkillComposition = {
      id: 'multi-error',
      name: 'Multi Error',
      description: 'Has multiple problems',
      version: '1.0.0',
      steps: [
        {
          stepId: 'step-1',
          skillId: 'missing-skill-a',
          inputBindings: {},
        },
        {
          stepId: 'step-2',
          skillId: 'missing-skill-b',
          inputBindings: {},
        },
      ],
    }

    const result = validator.validate(composition)
    expect(result.valid).toBe(false)
    // Two missing_skill errors
    const missingErrors = result.errors.filter((e) => e.type === 'missing_skill')
    expect(missingErrors.length).toBe(2)
  })
})
