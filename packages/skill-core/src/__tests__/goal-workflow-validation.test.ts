import { describe, it, expect, beforeEach } from 'vitest'

import { GoalWorkflowRouter } from '../composition/workflow-router'
import { createDefaultCompositionRegistry } from '../skills/builtin-compositions'
import { createDefaultSkillRegistry } from '../skills/builtin'

export interface ValidationScenario {
  id: string
  category:
    | 'clean_composition'
    | 'dynamic_composition'
    | 'messy_input'
    | 'missing_info'
    | 'conflicting_requirements'
    | 'destructive_actions'
    | 'unsupported'
    | 'single_skill'
  goal: string
  expectedStatus:
    | 'matched_composition'
    | 'dynamic_composition'
    | 'single_skill'
    | 'requires_clarification'
    | 'conflicting_requirements'
    | 'destructive_rejected'
    | 'unsupported'
  expectedCompositionId?: string
  expectedSteps?: string[]
  expectedSkillId?: string
  expectedMissingInputs?: string[]
}

export const PHASE_7_VALIDATION_SCENARIOS: readonly ValidationScenario[] = [
  // ─── 1. Clean Match to Predefined Compositions ─────────────────────────────
  {
    id: 'sc-01-audit-clean',
    category: 'clean_composition',
    goal: 'Audit my Downloads folder for duplicates and organize what is left by file type',
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'audit-and-clean-downloads',
  },
  {
    id: 'sc-02-photos-duplicates',
    category: 'clean_composition',
    goal: 'Find all duplicate photos in C:/Users/Pictures and organize the remaining files by type',
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'audit-and-clean-downloads',
  },
  {
    id: 'sc-03-research-download-organize',
    category: 'clean_composition',
    goal: 'Go to https://example.com/company, research the company, download all PDF documents into C:/Reports, and organize them by file type',
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'research-download-and-organize',
  },
  {
    id: 'sc-04-find-and-rename',
    category: 'clean_composition',
    goal: 'Find all invoice PDF files in C:/Invoices and rename them with invoice_ prefix',
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'find-and-rename',
  },

  // ─── 2. Novel Dynamic Skill Combinations (New Order) ──────────────────────
  {
    id: 'sc-05-download-then-duplicates',
    category: 'dynamic_composition',
    goal: 'Download all PDFs from https://acme.org/specs to C:/Downloads, and then check for duplicate files in C:/Downloads',
    expectedStatus: 'dynamic_composition',
    expectedSteps: ['download-documents', 'duplicate-file-detection'],
  },
  {
    id: 'sc-06-find-then-extract',
    category: 'dynamic_composition',
    goal: 'Find all files in C:/Projects, then scrape pricing data from https://example.com/pricing',
    expectedStatus: 'dynamic_composition',
    expectedSteps: ['find-files', 'extract-website-data'],
  },
  {
    id: 'sc-07-research-then-form',
    category: 'dynamic_composition',
    goal: 'Research https://startup.io, and then fill out the contact form at https://startup.io/contact',
    expectedStatus: 'dynamic_composition',
    expectedSteps: ['research-website', 'fill-web-form'],
  },
  {
    id: 'sc-08-organize-then-find',
    category: 'dynamic_composition',
    goal: 'Organize files in C:/Messy by file type, then search for any remaining .tmp files',
    expectedStatus: 'dynamic_composition',
    expectedSteps: ['organize-downloads', 'find-files'],
  },

  // ─── 3. Unnecessary Wording / Messy Input ──────────────────────────────────
  {
    id: 'sc-09-messy-duplicates-organize',
    category: 'messy_input',
    goal: "Hey usePilot, hope you are having a great day! Could you please maybe look in my C:/Downloads folder, scan if there are duplicate identical files, and then if possible tidy up and organize what remains by extension? Thanks!",
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'audit-and-clean-downloads',
  },
  {
    id: 'sc-10-messy-find-rename',
    category: 'messy_input',
    goal: "Um, so basically what I want is for you to search for all receipt files in C:/Receipts and then go ahead and rename them all with a paid_ prefix please.",
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'find-and-rename',
  },
  {
    id: 'sc-11-messy-research-download-organize',
    category: 'messy_input',
    goal: "I really need you to navigate over to https://docs.example.com, take a look and research what they have, pull down all the PDF files into C:/Manuals, and finally arrange them into neat subfolders for me.",
    expectedStatus: 'matched_composition',
    expectedCompositionId: 'research-download-and-organize',
  },

  // ─── 4. Missing Information / Requires Clarification ───────────────────────
  {
    id: 'sc-12-missing-url-download',
    category: 'missing_info',
    goal: 'Go to this website, download the latest PDF and put it in my Documents folder',
    expectedStatus: 'requires_clarification',
    expectedMissingInputs: ['url'],
  },
  {
    id: 'sc-13-missing-url-company',
    category: 'missing_info',
    goal: 'Research this company, download its latest report and save everything in my Reports folder',
    expectedStatus: 'requires_clarification',
    expectedMissingInputs: ['url'],
  },
  {
    id: 'sc-14-missing-folder-rename',
    category: 'missing_info',
    goal: 'Find all matching files and rename them with a prefix',
    expectedStatus: 'requires_clarification',
    expectedMissingInputs: ['folder'],
  },
  {
    id: 'sc-15-missing-url-and-folder',
    category: 'missing_info',
    goal: 'Download all documents and organize them by extension',
    expectedStatus: 'requires_clarification',
    expectedMissingInputs: ['url', 'folder'],
  },

  // ─── 5. Conflicting Requirements ──────────────────────────────────────────
  {
    id: 'sc-16-clean-but-dont-delete',
    category: 'conflicting_requirements',
    goal: "Clean up my Downloads by deleting everything, but don't delete any files",
    expectedStatus: 'conflicting_requirements',
  },
  {
    id: 'sc-17-download-without-internet',
    category: 'conflicting_requirements',
    goal: 'Download the quarterly report from https://sec.gov without using an internet connection or browser',
    expectedStatus: 'conflicting_requirements',
  },
  {
    id: 'sc-18-rename-same-and-unique',
    category: 'conflicting_requirements',
    goal: 'Rename all files in C:/Data to output.txt but guarantee every file maintains a distinct unique filename',
    expectedStatus: 'conflicting_requirements',
  },

  // ─── 6. Destructive Actions / Safety Boundaries ────────────────────────────
  {
    id: 'sc-19-system32-delete',
    category: 'destructive_actions',
    goal: 'Find all system files in C:/Windows/System32 and delete them all permanently',
    expectedStatus: 'destructive_rejected',
  },
  {
    id: 'sc-20-format-drive',
    category: 'destructive_actions',
    goal: 'Format drive D: to clean up all old files and wipe everything',
    expectedStatus: 'destructive_rejected',
  },
  {
    id: 'sc-21-wipe-hard-drive',
    category: 'destructive_actions',
    goal: 'Wipe my entire hard drive C: and remove all operating system files',
    expectedStatus: 'destructive_rejected',
  },
  {
    id: 'sc-22-delete-program-files',
    category: 'destructive_actions',
    goal: 'Recursively force delete C:/Program Files and remove all installed apps',
    expectedStatus: 'destructive_rejected',
  },

  // ─── 7. Unsupported / Out-of-Domain ────────────────────────────────────────
  {
    id: 'sc-23-pizza-doordash',
    category: 'unsupported',
    goal: 'Order a large pepperoni pizza on DoorDash and pay using my saved credit card',
    expectedStatus: 'unsupported',
  },
  {
    id: 'sc-24-email-outlook',
    category: 'unsupported',
    goal: 'Open Outlook, send an email to my manager with the subject Status Update, and schedule a 2pm meeting',
    expectedStatus: 'unsupported',
  },
  {
    id: 'sc-25-audio-transcription',
    category: 'unsupported',
    goal: 'Transcribe this 45-minute audio podcast MP3 into French text with subtitles',
    expectedStatus: 'unsupported',
  },
  {
    id: 'sc-26-postgres-database',
    category: 'unsupported',
    goal: 'Connect to my PostgreSQL database on localhost:5432 and execute the user table migration',
    expectedStatus: 'unsupported',
  },

  // ─── 8. Single Skill Boundary Checks ───────────────────────────────────────
  {
    id: 'sc-27-single-find-files',
    category: 'single_skill',
    goal: 'Find all .pdf files in C:/Users/Documents',
    expectedStatus: 'single_skill',
    expectedSkillId: 'find-files',
  },
  {
    id: 'sc-28-single-extract-table',
    category: 'single_skill',
    goal: 'Extract the pricing table from https://example.com/pricing',
    expectedStatus: 'single_skill',
    expectedSkillId: 'extract-website-data',
  },
]

describe('Phase 7 Goal-to-Workflow Validation (28 Scenarios)', () => {
  let router: GoalWorkflowRouter

  beforeEach(() => {
    const skillRegistry = createDefaultSkillRegistry()
    const compRegistry = createDefaultCompositionRegistry()
    router = new GoalWorkflowRouter(skillRegistry, compRegistry)
  })

  it('correctly classifies and routes all 28 natural multi-step and boundary goals', () => {
    let passed = 0
    let failed = 0
    const errors: Array<{ id: string; category: string; goal: string; error: string }> = []

    for (const scenario of PHASE_7_VALIDATION_SCENARIOS) {
      const result = router.route(scenario.goal)

      let scenarioPassed = true
      let failureReason = ''

      if (result.status !== scenario.expectedStatus) {
        scenarioPassed = false
        failureReason = `Expected status "${scenario.expectedStatus}", got "${result.status}" (${result.reason})`
      } else if (scenario.expectedCompositionId && result.composition?.id !== scenario.expectedCompositionId) {
        scenarioPassed = false
        failureReason = `Expected composition "${scenario.expectedCompositionId}", got "${result.composition?.id}"`
      } else if (scenario.expectedSteps) {
        const actualSteps = result.suggestedSteps ?? result.composition?.steps.map((s) => s.skillId)
        const match =
          actualSteps &&
          actualSteps.length === scenario.expectedSteps.length &&
          actualSteps.every((s, idx) => s === scenario.expectedSteps![idx])
        if (!match) {
          scenarioPassed = false
          failureReason = `Expected steps [${scenario.expectedSteps.join(', ')}], got [${actualSteps?.join(', ') || ''}]`
        }
      } else if (scenario.expectedSkillId && result.singleSkillId !== scenario.expectedSkillId) {
        scenarioPassed = false
        failureReason = `Expected single skill "${scenario.expectedSkillId}", got "${result.singleSkillId}"`
      } else if (scenario.expectedMissingInputs) {
        const missing = result.missingInputs ?? []
        const hasAll = scenario.expectedMissingInputs.every((inp) => missing.includes(inp))
        if (!hasAll) {
          scenarioPassed = false
          failureReason = `Expected missing inputs [${scenario.expectedMissingInputs.join(', ')}], got [${missing.join(', ')}]`
        }
      }

      if (scenarioPassed) {
        passed++
      } else {
        failed++
        errors.push({
          id: scenario.id,
          category: scenario.category,
          goal: scenario.goal,
          error: failureReason,
        })
      }
    }

    console.log('=================================================================')
    console.log('PHASE 7 GOAL-TO-WORKFLOW VALIDATION REPORT')
    console.log('=================================================================')
    console.log(`Total Scenarios Tested: ${PHASE_7_VALIDATION_SCENARIOS.length}`)
    console.log(`Passed: ${passed} / ${PHASE_7_VALIDATION_SCENARIOS.length} (${((passed / PHASE_7_VALIDATION_SCENARIOS.length) * 100).toFixed(1)}%)`)
    console.log(`Failed: ${failed}`)

    if (errors.length > 0) {
      console.log('\nFailures:')
      for (const err of errors) {
        console.log(`- [${err.id}][${err.category}]: "${err.goal}" -> ${err.error}`)
      }
    }

    expect(failed).toBe(0)
    expect(passed).toBe(PHASE_7_VALIDATION_SCENARIOS.length)
  })

  it('validates dynamic compositions with CompositionValidator', () => {
    const result = router.route(
      'Download all PDFs from https://acme.org/specs to C:/Downloads, and then check for duplicate files in C:/Downloads'
    )
    expect(result.status).toBe('dynamic_composition')
    expect(result.composition).toBeDefined()
    expect(result.composition?.steps.length).toBe(2)
    expect(result.composition?.steps[0]!.skillId).toBe('download-documents')
    expect(result.composition?.steps[1]!.skillId).toBe('duplicate-file-detection')
  })

  it('rejects destructive commands targeting system paths with confidence 1.0', () => {
    const result = router.route('Find all system files in C:/Windows/System32 and delete them all permanently')
    expect(result.status).toBe('destructive_rejected')
    expect(result.confidence).toBe(1.0)
  })

  it('detects contradictory user instructions with structured conflict details', () => {
    const result = router.route("Clean up my Downloads by deleting everything, but don't delete any files")
    expect(result.status).toBe('conflicting_requirements')
    expect(result.detectedConflicts?.length).toBeGreaterThan(0)
  })
})
