import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const ResearchAndSaveReportSkill: Skill = {
  id: 'research-and-save-report',
  name: 'Research and Save Report',
  description: 'Navigate to a target website or company page, analyze the content, generate a structured summary report, and write it to disk.',
  version: '1.0.0',
  category: 'cross_runtime',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Website or article URL to research',
      required: true,
      promptQuestion: 'What website URL should I research?',
      examples: ['https://company.example.com', 'https://en.wikipedia.org/wiki/Artificial_intelligence'],
    },
    topic: {
      name: 'topic',
      type: 'string',
      description: 'Research topic or focus area',
      required: true,
      promptQuestion: 'What specific topic or question should the report focus on?',
      examples: ['Company Overview', 'Financial Results', 'Product Lineup'],
    },
    outputFilePath: {
      name: 'outputFilePath',
      type: 'path',
      description: 'File path on disk where the generated report will be saved',
      required: true,
      promptQuestion: 'Where should the research report file be saved?',
      examples: ['~/Documents/ResearchReport.md', '~/Desktop/company_summary.md'],
    },
    format: {
      name: 'format',
      type: 'string',
      description: 'Report output format: markdown, json, or text',
      required: false,
      default: 'markdown',
      examples: ['markdown', 'json', 'text'],
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid URL is required'),
    topic: z.string().min(1, 'Research topic is required'),
    outputFilePath: z.string().min(1, 'Output file path is required'),
    format: z.enum(['markdown', 'json', 'text']).default('markdown'),
  }),

  outputs: {
    reportPath: {
      name: 'reportPath',
      type: 'path',
      description: 'Path to the generated report file on disk',
    },
    findingsCount: {
      name: 'findingsCount',
      type: 'number',
      description: 'Number of key insights extracted',
    },
  },

  requiredCapabilities: ['navigate_website', 'extract_web_data', 'write_file'],
  requiredPermissions: ['network.connect', 'filesystem.write'],
  riskLevel: 'medium',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'web-open-research-page',
        title: `Navigate to ${String(inputs['url'])}`,
        description: 'Load target research URL in the browser and await DOM stabilization',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          waitUntil: 'networkidle',
        }),
        preconditions: ['Browser ready', 'Network available'],
        postconditions: ['Page rendered and ready for data extraction'],
        successConditions: ['HTTP response status is 200-299'],
        dependsOn: [],
      },
      {
        id: 'web-extract-findings',
        title: `Extract key facts for topic "${String(inputs['topic'])}"`,
        description: 'Gather page title, headings, and textual paragraphs matching the research topic',
        category: 'extraction',
        requiredCapability: 'extract_web_data',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          topic: inp['topic'],
          selectors: ['h1', 'h2', 'h3', 'p', 'li'],
        }),
        preconditions: ['Page is open'],
        postconditions: ['Extracted findings formatted in memory'],
        successConditions: ['Research findings extracted without errors'],
        dependsOn: ['web-open-research-page'],
      },
      {
        id: 'fs-write-report',
        title: `Write summary report to ${String(inputs['outputFilePath'])}`,
        description: 'Compile findings into formatted report and atomically save to the target path',
        category: 'creation',
        requiredCapability: 'write_file',
        toolConfigFactory: (inp) => ({
          path: inp['outputFilePath'],
          format: inp['format'] ?? 'markdown',
          topic: inp['topic'],
          sourceUrl: inp['url'],
        }),
        preconditions: ['Findings extracted', 'Destination directory is writable'],
        postconditions: ['Report file exists on disk with complete research findings'],
        successConditions: ['Report written to disk and verified non-empty'],
        dependsOn: ['web-extract-findings'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'file_exists',
    conditions: [
      'Report file exists at specified path',
      'Report content contains research topic header and non-empty body',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      write_failed: 'Verify that the target file path is writable.',
      website_offline: 'Target website could not be reached.',
    },
  },

  contextRequirements: {
    needsBrowserState: true,
    needsFilesystemState: true,
    needsDomainKnowledge: true,
  },

  metadata: {
    tags: ['cross-runtime', 'browser', 'filesystem', 'research', 'report', 'markdown'],
    examples: [
      'Research this company and save the report to my Documents folder',
      'Research https://example.com topic Pricing save to ~/Documents/pricing.md',
      'Summarize website and write report to Desktop',
    ],
    category: 'cross_runtime',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
