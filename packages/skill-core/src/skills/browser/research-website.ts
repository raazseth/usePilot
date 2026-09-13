import { z } from 'zod'
import type { Skill } from '@usepilot/skill-types'

export const ResearchWebsiteSkill: Skill = {
  id: 'research-website',
  name: 'Research Website',
  description: 'Navigate to a website, inspect page layout, extract headings and main content, and summarize findings.',
  version: '1.0.0',
  category: 'browser',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Website URL to navigate to and analyze',
      required: true,
      promptQuestion: 'What website URL would you like me to research?',
      examples: ['https://example.com', 'https://github.com/about'],
    },
    topic: {
      name: 'topic',
      type: 'string',
      description: 'Specific topic, product, or feature to focus on',
      required: false,
      default: '',
      examples: ['Pricing', 'API Documentation', 'Company Mission'],
    },
    maxPages: {
      name: 'maxPages',
      type: 'number',
      description: 'Maximum number of pages to navigate within the domain',
      required: false,
      default: 1,
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid URL with http or https protocol is required'),
    topic: z.string().default(''),
    maxPages: z.number().default(1),
  }),

  outputs: {
    pageTitle: {
      name: 'pageTitle',
      type: 'string',
      description: 'Title of the main research page',
    },
    findingsSummary: {
      name: 'findingsSummary',
      type: 'string',
      description: 'Extracted key information and structured summary',
    },
    headings: {
      name: 'headings',
      type: 'array',
      description: 'H1, H2, and section titles discovered',
    },
  },

  requiredCapabilities: ['navigate_website', 'extract_web_data'],
  requiredPermissions: ['network.connect'],
  riskLevel: 'low',

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs) => [
      {
        id: 'navigate-to-page',
        title: `Navigate to ${String(inputs['url'])}`,
        description: 'Open website and wait for page network idle',
        category: 'navigation',
        requiredCapability: 'navigate_website',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          waitUntil: 'networkidle',
        }),
        preconditions: ['Browser session initialized', 'Network connection active'],
        postconditions: ['Page loaded successfully and DOM accessible'],
        successConditions: ['URL matches target domain', 'HTTP response status is 200-299'],
        dependsOn: [],
      },
      {
        id: 'extract-content',
        title: 'Extract headings and textual content',
        description: 'Collect page title, headings, and main article text',
        category: 'extraction',
        requiredCapability: 'extract_web_data',
        toolConfigFactory: (inp) => ({
          url: inp['url'],
          selectors: ['h1', 'h2', 'h3', 'p', 'main', 'article'],
          focusTopic: inp['topic'],
        }),
        preconditions: ['Page is loaded'],
        postconditions: ['Textual content captured and structured'],
        successConditions: ['Page title and non-empty content extracted'],
        dependsOn: ['navigate-to-page'],
      },
    ],
  },

  verificationDefinition: {
    strategy: 'state_check',
    conditions: [
      'Target website was reachable',
      'Page title and text content extracted successfully',
    ],
  },

  failurePolicy: {
    maxRetries: 2,
    allowFallback: false,
    semanticGuidance: {
      navigation_timeout: 'Verify that the website URL is accessible.',
      cloudflare_challenge: 'User may need to complete anti-bot challenge.',
    },
  },

  contextRequirements: {
    needsBrowserState: true,
    needsDomainKnowledge: true,
  },

  metadata: {
    tags: ['browser', 'research', 'web', 'extract', 'scrape'],
    examples: [
      'Research this company\'s website and summarize its products',
      'Research https://example.com',
      'Summarize features on website',
    ],
    category: 'browser',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
