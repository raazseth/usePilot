import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const OrganizeDownloadsSkill: Skill = {
  id: 'organize-downloads',
  name: 'Organize Downloads',
  description: 'Categorize and organize files in a folder into subfolders grouped by file type or extension.',
  version: '1.0.0',
  category: 'filesystem',

  inputs: {
    folder: {
      name: 'folder',
      type: 'path',
      description: 'Folder to organize (e.g. ~/Downloads)',
      required: true,
      promptQuestion: 'Which folder would you like to organize?',
      examples: ['~/Downloads', '~/Desktop/MessyFolder'],
    },
    groupBy: {
      name: 'groupBy',
      type: 'string',
      description: 'Grouping strategy: extension (PDFs, Images), or date',
      required: false,
      default: 'extension',
      examples: ['extension', 'date'],
    },
    destinationFolder: {
      name: 'destinationFolder',
      type: 'path',
      description: 'Optional destination directory if different from source',
      required: false,
    },
  },

  inputSchema: z.object({
    folder: z.string().min(1, 'Target folder is required'),
    groupBy: z.enum(['extension', 'fileType', 'date']).default('extension'),
    destinationFolder: z.string().optional(),
  }),

  outputs: {
    organizedCount: {
      name: 'organizedCount',
      type: 'number',
      description: 'Number of files successfully organized',
    },
    createdFolders: {
      name: 'createdFolders',
      type: 'array',
      description: 'Categories/folders created to sort files',
    },
  },

  requiredCapabilities: ['read_file', 'move_file', 'write_file'],
  requiredPermissions: ['filesystem.read', 'filesystem.write'],
  riskLevel: 'medium',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'inspect-folder',
        title: `Inspect contents of ${String(inputs['folder'])}`,
        description: 'Enumerate all unorganized files and categorize them by file extension',
        category: 'extraction',
        requiredCapability: 'read_file',
        toolConfigFactory: (inp) => ({
          operation: 'list_directory',
          path: inp['folder'],
        }),
        preconditions: ['Target folder exists'],
        postconditions: ['File inventory and categorization plan formulated'],
        successConditions: ['File list retrieved successfully'],
        dependsOn: [],
      },
      {
        id: 'create-category-folders',
        title: 'Create target category directories',
        description: 'Ensure folders like Documents, Images, Archives exist',
        category: 'creation',
        requiredCapability: 'write_file',
        toolConfigFactory: (inp) => ({
          operation: 'ensure_directories',
          basePath: inp['destinationFolder'] ?? inp['folder'],
          categories: ['Documents', 'Images', 'Archives', 'Code', 'Audio-Video', 'Other'],
        }),
        preconditions: ['Category names determined'],
        postconditions: ['Category folders exist'],
        successConditions: ['Folders exist or were created successfully'],
        dependsOn: ['inspect-folder'],
      },
      {
        id: 'move-files-to-categories',
        title: 'Move files into categorized folders',
        description: 'Relocate matching files into their corresponding category directory',
        category: 'modification',
        requiredCapability: 'move_file',
        toolConfigFactory: (inp) => ({
          operation: 'move_batch',
          sourcePath: inp['folder'],
          destinationPath: inp['destinationFolder'] ?? inp['folder'],
          groupBy: inp['groupBy'],
        }),
        preconditions: ['Category folders exist', 'Target files are not locked'],
        postconditions: ['Source folder is clean; files reside in organized folders'],
        successConditions: ['Files moved without collisions or data loss'],
        dependsOn: ['create-category-folders'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: [
      'Target organized directories exist',
      'Original files were safely relocated without data loss',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      folder_locked: 'Ensure no applications are actively editing files in the folder.',
      permission_denied: 'Grant filesystem write permissions to usePilot.',
    },
  },

  contextRequirements: {
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['filesystem', 'organize', 'cleanup', 'downloads', 'sorting'],
    examples: [
      'Organize my Downloads by file type',
      'Organize downloads folder',
      'Clean up files in Downloads',
    ],
    category: 'filesystem',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
