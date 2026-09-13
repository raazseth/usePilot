import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const BulkRenameFilesSkill: Skill = {
  id: 'bulk-rename-files',
  name: 'Bulk Rename Files',
  description: 'Rename multiple files according to a prefix, timestamp, or pattern replacement.',
  version: '1.0.0',
  category: 'filesystem',

  inputs: {
    folder: {
      name: 'folder',
      type: 'path',
      description: 'Folder containing files to rename',
      required: true,
      promptQuestion: 'Which folder contains the files you want to rename?',
      examples: ['~/Desktop/Screenshots', '~/Documents/Receipts'],
    },
    pattern: {
      name: 'pattern',
      type: 'string',
      description: 'Pattern to search for in filenames or prefix to prepend',
      required: true,
      promptQuestion: 'What pattern or prefix would you like to use for renaming?',
      examples: ['Screenshot', 'Invoice', 'IMG_'],
    },
    replacement: {
      name: 'replacement',
      type: 'string',
      description: 'Replacement string (or empty if prepending/appending)',
      required: false,
      default: '',
    },
    extensionFilter: {
      name: 'extensionFilter',
      type: 'string',
      description: 'Optional extension filter (e.g. .png, .pdf)',
      required: false,
      default: '*',
    },
  },

  inputSchema: z.object({
    folder: z.string().min(1, 'Target folder is required'),
    pattern: z.string().min(1, 'Rename pattern is required'),
    replacement: z.string().default(''),
    extensionFilter: z.string().default('*'),
  }),

  outputs: {
    renamedCount: {
      name: 'renamedCount',
      type: 'number',
      description: 'Number of files successfully renamed',
    },
    renamedFiles: {
      name: 'renamedFiles',
      type: 'array',
      description: 'Mapping of old filenames to new filenames',
    },
  },

  requiredCapabilities: ['read_file', 'move_file'],
  requiredPermissions: ['filesystem.read', 'filesystem.write'],
  riskLevel: 'medium',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'list-targets',
        title: `Identify files in ${String(inputs['folder'])} matching ${String(inputs['extensionFilter'] ?? '*')}`,
        description: 'Collect files eligible for renaming and check for name collisions',
        category: 'extraction',
        requiredCapability: 'read_file',
        toolConfigFactory: (inp) => ({
          operation: 'list_directory',
          path: inp['folder'],
          pattern: inp['extensionFilter'],
        }),
        preconditions: ['Folder exists'],
        postconditions: ['Candidate file list prepared with no duplicate target names'],
        successConditions: ['File list gathered without error'],
        dependsOn: [],
      },
      {
        id: 'execute-rename-batch',
        title: `Rename files using pattern "${String(inputs['pattern'])}"`,
        description: 'Perform atomic file renames across target files',
        category: 'modification',
        requiredCapability: 'move_file',
        toolConfigFactory: (inp) => ({
          operation: 'rename_batch',
          folder: inp['folder'],
          pattern: inp['pattern'],
          replacement: inp['replacement'],
          filter: inp['extensionFilter'],
        }),
        preconditions: ['No collisions detected'],
        postconditions: ['Files renamed to match pattern'],
        successConditions: ['Batch rename succeeded with zero collision errors'],
        dependsOn: ['list-targets'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: [
      'Renamed files exist under new names',
      'No files were accidentally deleted',
    ],
  },

  failurePolicy: {
    maxRetries: 1,
    allowFallback: false,
    semanticGuidance: {
      name_collision: 'Target filename already exists; specify a distinct prefix or pattern.',
    },
  },

  contextRequirements: {
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['filesystem', 'rename', 'batch', 'bulk', 'files'],
    examples: [
      'Rename these screenshots using today\'s date',
      'Bulk rename files in Receipts',
      'Batch rename photos with vacation prefix',
    ],
    category: 'filesystem',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
