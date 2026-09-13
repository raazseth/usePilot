import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const DownloadDocumentsSkill: Skill = {
  id: 'download-documents',
  name: 'Download Documents',
  description: 'Locate document links (PDF, CSV, Office docs) on a web page and save them to a local destination directory.',
  version: '1.0.0',
  category: 'browser',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Web page containing the documents to download',
      required: true,
      promptQuestion: 'Which web page contains the documents to download?',
      examples: ['https://example.com/reports', 'https://portal.company.com/invoices'],
    },
    targetDirectory: {
      name: 'targetDirectory',
      type: 'path',
      description: 'Local directory to save the downloaded files',
      required: true,
      promptQuestion: 'Which folder should the downloaded documents be saved to?',
      examples: ['~/Downloads', '~/Documents/Reports'],
    },
    fileExtension: {
      name: 'fileExtension',
      type: 'string',
      description: 'Filter by extension (e.g. .pdf, .csv, .xlsx)',
      required: false,
      default: '.pdf',
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid URL is required'),
    targetDirectory: z.string().min(1, 'Target directory is required'),
    fileExtension: z.string().default('.pdf'),
  }),

  outputs: {
    downloadedFiles: {
      name: 'downloadedFiles',
      type: 'array',
      description: 'Paths of all documents downloaded to disk',
    },
    downloadCount: {
      name: 'downloadCount',
      type: 'number',
      description: 'Total number of documents successfully downloaded',
    },
  },

  requiredCapabilities: ['navigate_website', 'download_file', 'write_file'],
  requiredPermissions: ['network.connect', 'filesystem.write'],
  riskLevel: 'medium',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'navigate-and-find-links',
        title: `Open ${String(inputs['url'])} and locate ${String(inputs['fileExtension'] ?? '.pdf')} links`,
        description: 'Scan page DOM for document anchors matching the requested extension',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          scanForExtensions: [inp['fileExtension']],
        }),
        preconditions: ['Browser session initialized'],
        postconditions: ['Document download links enumerated'],
        successConditions: ['Page reached and document links located'],
        dependsOn: [],
      },
      {
        id: 'download-and-save',
        title: `Download files to ${String(inputs['targetDirectory'])}`,
        description: 'Stream document bytes to the local filesystem and verify checksums',
        category: 'extraction',
        requiredCapability: 'download_file',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          destinationDir: inp['targetDirectory'],
          extension: inp['fileExtension'],
        }),
        preconditions: ['Download links available', 'Target directory writable'],
        postconditions: ['Files downloaded and present on disk'],
        successConditions: ['At least one document successfully downloaded to disk'],
        dependsOn: ['navigate-and-find-links'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: [
      'Target download directory exists',
      'Downloaded files exist on disk with valid file headers',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      no_links_found: 'No matching document links discovered on the page.',
      write_permission_denied: 'Check permissions for the target download folder.',
    },
  },

  contextRequirements: {
    needsBrowserState: true,
    needsFilesystemState: true,
  },

  metadata: {
    tags: ['browser', 'download', 'pdf', 'documents', 'filesystem'],
    examples: [
      'Download all available PDF reports from this page',
      'Download invoices from portal to ~/Downloads',
      'Save CSV data exports to Documents',
    ],
    category: 'browser',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
