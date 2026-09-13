import type { SkillComposition } from '@usepilot/skill-types'

import { SkillCompositionRegistry } from '../registry/composition-registry'

/**
 * Builtin Composition 1: Audit and Clean Downloads
 *
 * Intent: "Find duplicate files in my Downloads, then organize what remains by file type."
 *
 * Steps:
 *   1. duplicate-file-detection  →  scans folder for SHA-256 duplicates
 *   2. organize-downloads        →  categorizes remaining files by extension
 *
 * Both steps operate on the same folder. Step 1 is read-only (low risk).
 * Step 2 moves files (medium risk, may trigger optional approval).
 */
export const AuditAndCleanDownloadsComposition: SkillComposition = {
  id: 'audit-and-clean-downloads',
  name: 'Audit and Clean Downloads',
  description: 'Scan a folder for duplicate files then organize it by file type. Produces a clean, categorized directory.',
  version: '1.0.0',
  tags: ['filesystem', 'cleanup', 'duplicates', 'organize', 'downloads'],
  examples: [
    'Find all duplicate photos in my Pictures folder and organize the remaining files by type',
    'Audit my Downloads folder for duplicates and organize what is left by file type',
    'Clean up duplicate files in ~/Downloads and organize by extension',
    'Find duplicates in my folder and sort the remaining files',
  ],
  steps: [
    {
      stepId: 'detect-duplicates',
      skillId: 'duplicate-file-detection',
      inputBindings: {
        folder: { source: 'workflow_input', key: 'folder' },
        recursive: { source: 'workflow_input', key: 'recursive' },
      },
    },
    {
      stepId: 'organize-folder',
      skillId: 'organize-downloads',
      inputBindings: {
        // folder comes from the same initial input — not the step output (duplicate-detection is read-only)
        folder: { source: 'workflow_input', key: 'folder' },
        groupBy: { source: 'workflow_input', key: 'groupBy' },
      },
    },
  ],
}

/**
 * Builtin Composition 2: Research, Download, and Organize
 *
 * Intent: "Research a website, download the documents it links to, then organize them into my folder."
 *
 * Steps:
 *   1. research-website      →  navigate and analyze the page (read-only)
 *   2. download-documents    →  download linked documents to destination folder
 *   3. organize-downloads    →  sort downloaded files into categorized subfolders
 *
 * Demonstrates a full browser-to-organized-filesystem pipeline across three skills.
 */
export const ResearchDownloadAndOrganizeComposition: SkillComposition = {
  id: 'research-download-and-organize',
  name: 'Research, Download, and Organize',
  description: 'Navigate to a website, research it, download its documents, and organize them into categorized subfolders on disk.',
  version: '1.0.0',
  tags: ['browser', 'filesystem', 'cross-runtime', 'research', 'download', 'organize'],
  examples: [
    'Research this company, download its latest report and save everything in my Reports folder',
    'Go to this website, download the latest PDF and put it in my Documents folder',
    'Browse the website, download documentation PDFs and organize them into folders',
    'Research product site, download manuals, and organize files by category',
  ],
  steps: [
    {
      stepId: 'research-page',
      skillId: 'research-website',
      inputBindings: {
        url: { source: 'workflow_input', key: 'url' },
        topic: { source: 'workflow_input', key: 'topic' },
      },
    },
    {
      stepId: 'download-docs',
      skillId: 'download-documents',
      inputBindings: {
        url: { source: 'workflow_input', key: 'url' },
        targetDirectory: { source: 'workflow_input', key: 'destinationFolder' },
        fileExtension: { source: 'workflow_input', key: 'fileExtension' },
      },
    },
    {
      stepId: 'organize-docs',
      skillId: 'organize-downloads',
      inputBindings: {
        // Use the destination folder from the initial input as the folder to organize
        folder: { source: 'workflow_input', key: 'destinationFolder' },
        groupBy: { source: 'workflow_input', key: 'groupBy' },
      },
    },
  ],
}

/**
 * Builtin Composition 3: Find and Rename Files
 *
 * Intent: "Find all files matching a pattern in my folder, then bulk rename them."
 *
 * Steps:
 *   1. find-files           →  locate files matching extension/pattern (read-only)
 *   2. bulk-rename-files    →  rename matched files using the specified pattern
 *
 * The find step establishes context; the rename step applies changes.
 * Both operate on the same folder supplied as initial input.
 */
export const FindAndRenameComposition: SkillComposition = {
  id: 'find-and-rename',
  name: 'Find and Rename Files',
  description: 'Find all files matching a pattern in a folder then bulk rename them using a specified naming rule.',
  version: '1.0.0',
  tags: ['filesystem', 'find', 'rename', 'batch', 'bulk'],
  examples: [
    'Find my invoice PDFs and rename them with an invoice prefix',
    'Find all files matching a pattern in my folder, then bulk rename them',
    'Search for receipt files and rename them with a date prefix',
    'Locate log files and add archive prefix',
  ],
  steps: [
    {
      stepId: 'find-targets',
      skillId: 'find-files',
      inputBindings: {
        directory: { source: 'workflow_input', key: 'folder' },
        pattern: { source: 'workflow_input', key: 'findPattern' },
        extension: { source: 'workflow_input', key: 'extension' },
      },
    },
    {
      stepId: 'rename-targets',
      skillId: 'bulk-rename-files',
      inputBindings: {
        // Operate on the same folder from initial inputs
        folder: { source: 'workflow_input', key: 'folder' },
        pattern: { source: 'workflow_input', key: 'renamePattern' },
        replacement: { source: 'workflow_input', key: 'replacement' },
        extensionFilter: { source: 'workflow_input', key: 'extension' },
      },
    },
  ],
}

/**
 * All builtin compositions, exported as a readonly array.
 */
export const BUILTIN_COMPOSITIONS: readonly SkillComposition[] = [
  AuditAndCleanDownloadsComposition,
  ResearchDownloadAndOrganizeComposition,
  FindAndRenameComposition,
] as const

/**
 * Creates and initializes a SkillCompositionRegistry pre-populated
 * with all three builtin compositions.
 */
export function createDefaultCompositionRegistry(): SkillCompositionRegistry {
  const registry = new SkillCompositionRegistry()
  for (const composition of BUILTIN_COMPOSITIONS) {
    registry.register(composition)
  }
  return registry
}
