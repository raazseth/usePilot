import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const FindFilesSkill: Skill = {
  id: 'find-files',
  name: 'Find Files',
  description: 'Search for files in a directory matching specific names, extensions, or content patterns.',
  version: '1.0.0',
  category: 'filesystem',

  inputs: {
    directory: {
      name: 'directory',
      type: 'path',
      description: 'Root directory to search within',
      required: true,
      promptQuestion: 'Which folder would you like to search in?',
      examples: ['~/Documents', '~/Downloads', 'C:\\Projects'],
    },
    folder: {
      name: 'folder',
      type: 'path',
      description: 'Alternative alias for directory',
      required: false,
    },
    pattern: {
      name: 'pattern',
      type: 'string',
      description: 'File name pattern or extension (e.g. *.pdf, invoice*)',
      required: false,
      default: '*',
      examples: ['*.pdf', 'invoice*', '*.ts'],
    },
    query: {
      name: 'query',
      type: 'string',
      description: 'Keyword search query',
      required: false,
    },
    extension: {
      name: 'extension',
      type: 'string',
      description: 'File extension filter without dot (e.g. pdf)',
      required: false,
    },
    recursive: {
      name: 'recursive',
      type: 'boolean',
      description: 'Whether to search subdirectories recursively',
      required: false,
      default: true,
    },
  },

  inputSchema: z.object({
    directory: z.string().optional(),
    folder: z.string().optional(),
    pattern: z.string().optional(),
    query: z.string().optional(),
    extension: z.string().optional(),
    recursive: z.boolean().default(true),
  }).refine((data) => Boolean(data.directory || data.folder), {
    message: 'Directory or folder path is required',
  }),

  outputs: {
    matchingFiles: {
      name: 'matchingFiles',
      type: 'array',
      description: 'List of matching file paths found',
    },
    count: {
      name: 'count',
      type: 'number',
      description: 'Number of matching files found',
    },
  },

  requiredCapabilities: ['read_file'],
  requiredPermissions: ['filesystem.read'],
  riskLevel: 'low',

  workflowDefinition: {
    estimatedComplexity: 'low',
    generateTasks: (inputs) => {
      const targetDir = String(inputs['directory'] ?? inputs['folder'] ?? '.')
      const targetPattern = String(
        inputs['pattern'] ??
        inputs['query'] ??
        (inputs['extension'] ? `*.${String(inputs['extension'])}` : '*')
      )
      return [
        {
          id: 'scan-directory',
          title: `Scan ${targetDir} for matching files`,
          description: `Inspect directory contents matching pattern "${targetPattern}"`,
          category: 'extraction',
          requiredCapability: 'read_file',
          toolConfigFactory: () => ({
            operation: 'list_directory',
            path: targetDir,
            pattern: targetPattern,
            recursive: inputs['recursive'] ?? true,
          }),
          preconditions: ['Target directory exists and is accessible'],
          postconditions: ['Matching file paths are collected'],
          successConditions: ['Directory listing completed without permission errors'],
          dependsOn: [],
        },
      ]
    },
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: ['Search directory exists and was accessible'],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      directory_not_found: 'Verify that the specified directory exists.',
      permission_denied: 'Grant filesystem read permissions to usePilot.',
    },
  },

  contextRequirements: {
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['filesystem', 'search', 'find', 'files', 'pdf'],
    examples: [
      'Find all PDFs containing invoice',
      'Find files in Downloads',
      'Search for typescript files in project',
    ],
    category: 'filesystem',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
