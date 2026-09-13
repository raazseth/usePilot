import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const ExtractWebsiteDataSkill: Skill = {
  id: 'extract-website-data',
  name: 'Extract Website Data',
  description: 'Scrape structured records (tables, product listings, pricing) from a target web page.',
  version: '1.0.0',
  category: 'browser',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Web page URL to extract data from',
      required: true,
      promptQuestion: 'What webpage URL would you like to extract data from?',
      examples: ['https://example.com/products', 'https://news.ycombinator.com'],
    },
    selector: {
      name: 'selector',
      type: 'string',
      description: 'CSS selector or table element identifying the records',
      required: false,
      default: 'table, .item, .card, article',
    },
    fields: {
      name: 'fields',
      type: 'array',
      description: 'List of field names to extract (e.g. title, price, link)',
      required: false,
      default: ['title', 'text', 'href'],
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid web URL is required'),
    selector: z.string().default('table, .item, .card, article'),
    fields: z.array(z.string()).default(['title', 'text', 'href']),
  }),

  outputs: {
    records: {
      name: 'records',
      type: 'array',
      description: 'Structured array of extracted data items',
    },
    recordCount: {
      name: 'recordCount',
      type: 'number',
      description: 'Total records extracted',
    },
  },

  requiredCapabilities: ['navigate_website', 'extract_web_data'],
  requiredPermissions: ['network.connect'],
  riskLevel: 'low',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'open-target-url',
        title: `Navigate to ${String(inputs['url'])}`,
        description: 'Load page and await dynamic DOM rendering',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          waitUntil: 'domcontentloaded',
        }),
        preconditions: ['Browser session active'],
        postconditions: ['DOM accessible for query selector extraction'],
        successConditions: ['Page loaded with status 200-299'],
        dependsOn: [],
      },
      {
        id: 'scrape-elements',
        title: `Extract records matching "${String(inputs['selector'] ?? 'table')}"`,
        description: 'Iterate over DOM elements and extract structured field values',
        category: 'extraction',
        requiredCapability: 'extract_web_data',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          selector: inp['selector'],
          fields: inp['fields'],
        }),
        preconditions: ['Target DOM elements loaded'],
        postconditions: ['Structured records extracted into memory'],
        successConditions: ['At least one matching record or table extracted'],
        dependsOn: ['open-target-url'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'state_check',
    conditions: [
      'Target page was loaded',
      'Extracted records data structure is non-empty',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      no_elements_matched: 'Target selector did not match elements. Verify page HTML.',
    },
  },

  contextRequirements: {
    needsBrowserState: true,
  },

  metadata: {
    tags: ['browser', 'scrape', 'extract', 'table', 'data'],
    examples: [
      'Extract all product names and prices from this page',
      'Scrape table data from https://example.com',
      'Extract articles from news feed',
    ],
    category: 'browser',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
