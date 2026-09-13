import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const DownloadAndOrganizeSkill: Skill = {
  id: 'download-and-organize',
  name: 'Download and Organize',
  description: 'Download documents from a target web page and automatically organize them into categorized subfolders on the local filesystem.',
  version: '1.0.0',
  category: 'cross_runtime',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Web page URL containing files to download',
      required: true,
      promptQuestion: 'Which web page should I download files from?',
      examples: ['https://portal.example.com/invoices', 'https://example.com/financial-reports'],
    },
    destinationFolder: {
      name: 'destinationFolder',
      type: 'path',
      description: 'Local directory to organize the downloaded files into',
      required: true,
      promptQuestion: 'Which local folder should the organized files be placed into?',
      examples: ['~/Documents/Finance', '~/Downloads/OrganizedReports'],
    },
    fileExtension: {
      name: 'fileExtension',
      type: 'string',
      description: 'File extension filter (e.g. .pdf, .csv)',
      required: false,
      default: '.pdf',
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid URL is required'),
    destinationFolder: z.string().min(1, 'Destination folder is required'),
    fileExtension: z.string().default('.pdf'),
  }),

  outputs: {
    downloadedCount: {
      name: 'downloadedCount',
      type: 'number',
      description: 'Total number of files downloaded and organized',
    },
    organizedPath: {
      name: 'organizedPath',
      type: 'path',
      description: 'Final filesystem directory containing the organized files',
    },
  },

  requiredCapabilities: ['navigate_website', 'download_file', 'write_file', 'move_file'],
  requiredPermissions: ['network.connect', 'filesystem.read', 'filesystem.write'],
  riskLevel: 'medium',

  workflowDefinition: {
    estimatedComplexity: 'high',
    generateTasks: (inputs) => [
      {
        id: 'web-locate-files',
        title: `Navigate to ${String(inputs['url'])} and locate ${String(inputs['fileExtension'] ?? '.pdf')} downloads`,
        description: 'Scan page for available report and document downloads',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          scanForExtensions: [inp['fileExtension']],
        }),
        preconditions: ['Browser session active', 'Target URL reachable'],
        postconditions: ['List of download URLs established'],
        successConditions: ['Page visited and download links discovered'],
        dependsOn: [],
      },
      {
        id: 'web-download-to-staging',
        title: 'Download documents to staging directory',
        description: 'Stream files from the web into a temporary staging folder',
        category: 'extraction',
        requiredCapability: 'download_file',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          destinationDir: `${String(inp['destinationFolder'])}/_staging`,
          extension: inp['fileExtension'],
        }),
        preconditions: ['Download URLs discovered'],
        postconditions: ['Raw files downloaded to staging'],
        successConditions: ['Files written to staging without corruption'],
        dependsOn: ['web-locate-files'],
      },
      {
        id: 'fs-ensure-destination-structure',
        title: `Prepare directory structure in ${String(inputs['destinationFolder'])}`,
        description: 'Create organized category folders (e.g. Invoices, Reports) at destination',
        category: 'creation',
        requiredCapability: 'write_file',
        toolConfigFactory: (inp) => ({
          operation: 'ensure_directories',
          basePath: inp['destinationFolder'],
          categories: ['Reports', 'Invoices', 'Documents', 'Archive'],
        }),
        preconditions: ['Destination path is writable'],
        postconditions: ['Target directory tree prepared'],
        successConditions: ['Directories verified'],
        dependsOn: ['web-download-to-staging'],
      },
      {
        id: 'fs-relocate-to-final',
        title: 'Sort and relocate downloaded files into final destination',
        description: 'Move files from staging to categorized directories and remove staging folder',
        category: 'modification',
        requiredCapability: 'move_file',
        toolConfigFactory: (inp) => ({
          operation: 'move_batch',
          sourcePath: `${String(inp['destinationFolder'])}/_staging`,
          destinationPath: inp['destinationFolder'],
        }),
        preconditions: ['Staging files exist', 'Target directories ready'],
        postconditions: ['Files reside cleanly in final destination directory'],
        successConditions: ['Files relocated with zero collisions'],
        dependsOn: ['fs-ensure-destination-structure'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: [
      'Destination folder exists on disk',
      'Downloaded files exist at destination and are non-empty',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
  },

  contextRequirements: {
    needsBrowserState: true,
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['cross-runtime', 'browser', 'filesystem', 'download', 'organize'],
    examples: [
      'Download these reports and put them into my Finance folder',
      'Download invoices from portal and organize by type',
      'Fetch documents from website and save to Documents',
    ],
    category: 'cross_runtime',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
