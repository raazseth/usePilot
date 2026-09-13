import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const DuplicateDetectionSkill: Skill = {
  id: 'duplicate-file-detection',
  name: 'Duplicate File Detection',
  description: 'Scan a directory for identical duplicate files by comparing file sizes and content hashes. Does not delete files.',
  version: '1.0.0',
  category: 'filesystem',

  inputs: {
    folder: {
      name: 'folder',
      type: 'path',
      description: 'Folder to scan for duplicates',
      required: true,
      promptQuestion: 'Which folder should I inspect for duplicate files?',
      examples: ['~/Downloads', '~/Documents'],
    },
    recursive: {
      name: 'recursive',
      type: 'boolean',
      description: 'Whether to scan subfolders recursively',
      required: false,
      default: true,
    },
    minSizeBytes: {
      name: 'minSizeBytes',
      type: 'number',
      description: 'Minimum file size in bytes to inspect (default 1024 bytes)',
      required: false,
      default: 1024,
    },
  },

  inputSchema: z.object({
    folder: z.string().min(1, 'Target folder is required'),
    recursive: z.boolean().default(true),
    minSizeBytes: z.number().default(1024),
  }),

  outputs: {
    duplicateGroups: {
      name: 'duplicateGroups',
      type: 'array',
      description: 'Sets of duplicate file paths grouped by SHA-256 content hash',
    },
    wastedBytes: {
      name: 'wastedBytes',
      type: 'number',
      description: 'Estimated disk space occupied by redundant copies',
    },
  },

  requiredCapabilities: ['read_file'],
  requiredPermissions: ['filesystem.read'],
  riskLevel: 'low',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'index-file-sizes',
        title: `Scan ${String(inputs['folder'])} and index file sizes`,
        description: 'Enumerate files and bucket those with identical byte sizes',
        category: 'extraction',
        requiredCapability: 'read_file',
        toolConfigFactory: (inp) => ({
          operation: 'scan_sizes',
          folder: inp['folder'],
          recursive: inp['recursive'],
          minSize: inp['minSizeBytes'],
        }),
        preconditions: ['Target folder exists'],
        postconditions: ['Candidate file buckets identified'],
        successConditions: ['File size scanning complete'],
        dependsOn: [],
      },
      {
        id: 'hash-matching-files',
        title: 'Compute SHA-256 hashes for size-matched candidates',
        description: 'Verify identical byte contents across candidate duplicate pairs without modifying files',
        category: 'computation',
        requiredCapability: 'read_file',
        toolConfigFactory: (inp) => ({
          operation: 'compute_hashes',
          folder: inp['folder'],
        }),
        preconditions: ['Size-matched candidates exist'],
        postconditions: ['Verified duplicate groups and wasted space recorded'],
        successConditions: ['Hash verification complete'],
        dependsOn: ['index-file-sizes'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'state_check',
    conditions: [
      'Scanned files remain intact and unaltered',
      'Reported hashes correspond to existing files',
    ],
  },

  failurePolicy: {
    maxRetries: 1,
    allowFallback: false,
  },

  contextRequirements: {
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['filesystem', 'duplicates', 'audit', 'hash', 'clean'],
    examples: [
      'Find duplicate files in Downloads',
      'Detect duplicate photos or PDFs',
      'Find duplicates in Documents folder',
    ],
    category: 'filesystem',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
