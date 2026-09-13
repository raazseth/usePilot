import { z } from 'zod'
import type { Skill, WorkflowTaskTemplate } from '@usepilot/skill-types'

export const FillWebFormSkill: Skill = {
  id: 'fill-web-form',
  name: 'Fill Web Form',
  description: 'Populate inputs, textareas, and dropdowns on a web page with provided field values. Mandatory approval is enforced before final submission.',
  version: '1.0.0',
  category: 'browser',

  inputs: {
    url: {
      name: 'url',
      type: 'url',
      description: 'Web page URL containing the form',
      required: true,
      promptQuestion: 'What is the URL of the form you want to fill?',
      examples: ['https://portal.example.com/apply', 'https://forms.company.com/contact'],
    },
    formData: {
      name: 'formData',
      type: 'object',
      description: 'Key-value map of form field labels/selectors to input values',
      required: true,
      promptQuestion: 'What information should I enter into the form fields?',
      examples: ['{"name": "Jane Doe", "email": "jane@example.com"}'],
    },
    submitAfterFill: {
      name: 'submitAfterFill',
      type: 'boolean',
      description: 'Whether to click the final Submit button after filling. Requires mandatory human approval.',
      required: false,
      default: false,
    },
  },

  inputSchema: z.object({
    url: z.string().url('A valid URL is required'),
    formData: z.record(z.unknown()),
    submitAfterFill: z.boolean().default(false),
  }),

  outputs: {
    fieldsFilled: {
      name: 'fieldsFilled',
      type: 'array',
      description: 'List of fields successfully populated',
    },
    submissionStatus: {
      name: 'submissionStatus',
      type: 'string',
      description: 'Draft saved or submitted',
    },
  },

  requiredCapabilities: ['navigate_website', 'extract_web_data'],
  requiredPermissions: ['network.connect'],
  riskLevel: 'high', // High because forms modify external remote state

  workflowDefinition: {
    estimatedComplexity: 'medium',
    generateTasks: (inputs): WorkflowTaskTemplate[] => {
      const willSubmit = Boolean(inputs['submitAfterFill'])
      const tasks: WorkflowTaskTemplate[] = [
        {
          id: 'navigate-to-form',
          title: `Open form at ${String(inputs['url'])}`,
          description: 'Navigate to target form page and wait for interactive inputs',
          category: 'navigation',
          requiredCapability: 'navigate_website',
          toolConfigFactory: (inp: Record<string, unknown>) => ({
            url: inp['url'],
            waitUntil: 'domcontentloaded',
          }),
          preconditions: ['Browser session active'],
          postconditions: ['Form inputs present in DOM'],
          successConditions: ['Page reached and form element found'],
          dependsOn: [],
          approvalPolicy: 'automatic',
        },
        {
          id: 'fill-form-inputs',
          title: 'Fill form input fields',
          description: 'Set values for specified inputs, textareas, and select elements',
          category: 'modification',
          requiredCapability: 'extract_web_data',
          toolConfigFactory: (inp: Record<string, unknown>) => ({
            operation: 'fill_form',
            formData: inp['formData'],
          }),
          preconditions: ['Form inputs visible and enabled'],
          postconditions: ['Fields populated with user values'],
          successConditions: ['All specified fields filled without input validation errors'],
          dependsOn: ['navigate-to-form'],
          approvalPolicy: 'automatic',
        },
      ]

      if (willSubmit) {
        tasks.push({
          id: 'submit-form-button',
          title: 'Submit the completed form',
          description: 'Click the submit button to transmit form data to the server',
          category: 'communication',
          requiredCapability: 'extract_web_data',
          toolConfigFactory: () => ({
            operation: 'click_submit',
            selector: 'button[type="submit"], input[type="submit"], button:has-text("Submit")',
          }),
          preconditions: ['All mandatory form fields populated'],
          postconditions: ['Form submitted and confirmation displayed'],
          successConditions: ['Submission network response received or navigation occurred'],
          dependsOn: ['fill-form-inputs'],
          // MANDATORY HUMAN APPROVAL — Invariant 6: Never bypass approval for consequential submission
          approvalPolicy: 'mandatory',
          approvalReason: 'Form submission is a consequential action that alters external system state.',
        })
      }

      return tasks
    },
  },

  verificationDefinition: {
    strategy: 'dom_check',
    conditions: [
      'Target form fields contain expected values',
      'If submitted, confirmation element or redirect is verified',
    ],
  },

  failurePolicy: {
    maxRetries: 1,
    allowFallback: false,
    semanticGuidance: {
      input_not_found: 'A specified form field could not be located on the page.',
      validation_error: 'Page reported form validation error on one or more inputs.',
    },
  },

  contextRequirements: {
    needsBrowserState: true,
    needsDomainKnowledge: true,
  },

  metadata: {
    tags: ['browser', 'form', 'fill', 'submit', 'automation'],
    examples: [
      'Fill this application form with the information I provided',
      'Fill out the registration form',
      'Enter details into form on portal',
    ],
    category: 'browser',
    createdAt: Date.now(),
    updatedAt: Date.now(),
  },
}
