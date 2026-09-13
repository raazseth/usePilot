/**
 * Deterministic Validation Corpus for Skill Discovery and Resolution Hardening.
 * Covers 165 real-world human requests across:
 * - Clean, informal, conversational, synonyms, typos (35)
 * - Collisions and intent disambiguation (35)
 * - False positives & unsupported requests (35)
 * - Parameter extraction (35)
 * - Context-dependent and clarification/ambiguity cases (25)
 */

export interface ValidationScenario {
  id: string
  category:
    | 'clean'
    | 'informal'
    | 'conversational'
    | 'synonyms'
    | 'typos'
    | 'collision'
    | 'false_positive'
    | 'parameter'
    | 'context'
    | 'ambiguous'
  userPrompt: string
  expectedSkillId: string | null // null if unsupported / false positive
  context?: {
    activeDirectory?: string
    activeBrowserUrl?: string
    activeBrowserTitle?: string
    selectedFiles?: string[]
    clipboardText?: string
  }
  expectedInputs?: Record<string, unknown>
  expectMissingInputs?: string[]
  expectedConfidence?: 'clear' | 'ambiguous' | 'insufficient_context' | 'unsupported'
}

export const VALIDATION_CORPUS: ValidationScenario[] = [
  // =========================================================================
  // 1. CLEAN, INFORMAL, CONVERSATIONAL, SYNONYMS, TYPOS (35 cases)
  // =========================================================================
  {
    id: 'disc-01',
    category: 'clean',
    userPrompt: 'Organize my Downloads folder.',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-02',
    category: 'clean',
    userPrompt: 'Find invoice PDFs in Documents.',
    expectedSkillId: 'find-files',
  },
  {
    id: 'disc-03',
    category: 'clean',
    userPrompt: 'Find duplicate files in Downloads.',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-04',
    category: 'clean',
    userPrompt: 'Rename these screenshots using YYYY-MM-DD.',
    expectedSkillId: 'bulk-rename',
  },
  {
    id: 'disc-05',
    category: 'clean',
    userPrompt: 'Research this company website and summarize its products.',
    expectedSkillId: 'research-website',
  },
  {
    id: 'disc-06',
    category: 'clean',
    userPrompt: 'Extract all product names and prices from this page.',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'disc-07',
    category: 'clean',
    userPrompt: 'Download all available PDF reports from this page.',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'disc-08',
    category: 'clean',
    userPrompt: 'Fill this application form with the information I provided.',
    expectedSkillId: 'fill-web-form',
  },
  {
    id: 'disc-09',
    category: 'informal',
    userPrompt: 'clean up downloads',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-10',
    category: 'informal',
    userPrompt: 'get rid of duplicate files',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-11',
    category: 'informal',
    userPrompt: 'find that invoice pdf',
    expectedSkillId: 'find-files',
  },
  {
    id: 'disc-12',
    category: 'informal',
    userPrompt: 'grab the reports from this site',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'disc-13',
    category: 'conversational',
    userPrompt: 'Can you clean up the mess in my Downloads?',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-14',
    category: 'conversational',
    userPrompt: 'I need all the invoices from last month in my Documents.',
    expectedSkillId: 'find-files',
  },
  {
    id: 'disc-15',
    category: 'conversational',
    userPrompt: 'Could you grab those PDFs and put them somewhere organized?',
    expectedSkillId: 'download-and-organize',
  },
  {
    id: 'disc-16',
    category: 'conversational',
    userPrompt: 'Find the duplicate files in my Documents.',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-17',
    category: 'conversational',
    userPrompt: 'Please look through this website and summarize what this business sells.',
    expectedSkillId: 'research-website',
  },
  {
    id: 'disc-18',
    category: 'conversational',
    userPrompt: 'Can you scrape the prices and titles from this catalog page?',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'disc-19',
    category: 'synonyms',
    userPrompt: 'tidy my Downloads',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-20',
    category: 'synonyms',
    userPrompt: 'sort my Downloads directory',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-21',
    category: 'synonyms',
    userPrompt: 'locate invoice documents',
    expectedSkillId: 'find-files',
  },
  {
    id: 'disc-22',
    category: 'synonyms',
    userPrompt: 'look for duplicate files',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-23',
    category: 'synonyms',
    userPrompt: 'batch rename all photos in my Pictures folder',
    expectedSkillId: 'bulk-rename',
  },
  {
    id: 'disc-24',
    category: 'synonyms',
    userPrompt: 'investigate this startup website https://modal.com',
    expectedSkillId: 'research-website',
  },
  {
    id: 'disc-25',
    category: 'synonyms',
    userPrompt: 'pull tabular data from this webpage',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'disc-26',
    category: 'synonyms',
    userPrompt: 'fetch document files from https://example.com/reports',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'disc-27',
    category: 'synonyms',
    userPrompt: 'populate the registration form with my details',
    expectedSkillId: 'fill-web-form',
  },
  {
    id: 'disc-28',
    category: 'synonyms',
    userPrompt: 'check for identical copies in ~/Desktop',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-29',
    category: 'typos',
    userPrompt: 'organise my downlaods',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'disc-30',
    category: 'typos',
    userPrompt: 'find invoise pdfs in Documents',
    expectedSkillId: 'find-files',
  },
  {
    id: 'disc-31',
    category: 'typos',
    userPrompt: 'renmae these screenshots',
    expectedSkillId: 'bulk-rename',
  },
  {
    id: 'disc-32',
    category: 'typos',
    userPrompt: 'downlaod pdf reports from https://example.com/docs',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'disc-33',
    category: 'typos',
    userPrompt: 'reaserch this website https://acme.org',
    expectedSkillId: 'research-website',
  },
  {
    id: 'disc-34',
    category: 'typos',
    userPrompt: 'duplicat files in Downloads',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'disc-35',
    category: 'typos',
    userPrompt: 'fil form at https://example.com/signup',
    expectedSkillId: 'fill-web-form',
  },

  // =========================================================================
  // 2. COLLISIONS & INTENT DISAMBIGUATION (35 cases)
  // =========================================================================
  {
    id: 'coll-01',
    category: 'collision',
    userPrompt: 'Find PDFs on this website https://company.com/docs',
    expectedSkillId: 'download-documents', // Intent is finding/getting documents from web
  },
  {
    id: 'coll-02',
    category: 'collision',
    userPrompt: 'Find all PDF files in my Downloads directory',
    expectedSkillId: 'find-files', // Local filesystem search
  },
  {
    id: 'coll-03',
    category: 'collision',
    userPrompt: 'Find duplicate PDFs in Downloads',
    expectedSkillId: 'duplicate-detection', // Explicit duplicate intent takes precedence over find-files
  },
  {
    id: 'coll-04',
    category: 'collision',
    userPrompt: 'Find duplicate receipts in ~/Accounting',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'coll-05',
    category: 'collision',
    userPrompt: 'Find all receipts in ~/Accounting',
    expectedSkillId: 'find-files',
  },
  {
    id: 'coll-06',
    category: 'collision',
    userPrompt: 'Download financial reports from https://sec.gov and organize them into Finance',
    expectedSkillId: 'download-and-organize', // Cross-runtime: download + organize
  },
  {
    id: 'coll-07',
    category: 'collision',
    userPrompt: 'Download invoices from https://billing.com',
    expectedSkillId: 'download-documents', // Pure document download
  },
  {
    id: 'coll-08',
    category: 'collision',
    userPrompt: 'Download statements from https://bank.com and sort into ~/BankStatements',
    expectedSkillId: 'download-and-organize',
  },
  {
    id: 'coll-09',
    category: 'collision',
    userPrompt: 'Research Anthropic on https://anthropic.com and save the report to ~/Documents/AI',
    expectedSkillId: 'research-and-save-report', // Cross-runtime: research + save report file
  },
  {
    id: 'coll-10',
    category: 'collision',
    userPrompt: 'Research OpenAI on https://openai.com',
    expectedSkillId: 'research-website', // Browser research only
  },
  {
    id: 'coll-11',
    category: 'collision',
    userPrompt: 'Extract tabular pricing data from https://cloud.com/pricing',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'coll-12',
    category: 'collision',
    userPrompt: 'Research cloud pricing on https://cloud.com and write a summary report to disk',
    expectedSkillId: 'research-and-save-report',
  },
  {
    id: 'coll-13',
    category: 'collision',
    userPrompt: 'Organize photos in ~/Photos by date',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'coll-14',
    category: 'collision',
    userPrompt: 'Find duplicate photos in ~/Photos',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'coll-15',
    category: 'collision',
    userPrompt: 'Rename photos in ~/Photos to vacation_2024_',
    expectedSkillId: 'bulk-rename',
  },
  {
    id: 'coll-16',
    category: 'collision',
    userPrompt: 'Search for all files matching *.log in ~/var/log',
    expectedSkillId: 'find-files',
  },
  {
    id: 'coll-17',
    category: 'collision',
    userPrompt: 'Scrape stock prices table from https://finance.yahoo.com',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'coll-18',
    category: 'collision',
    userPrompt: 'Download annual filing PDF from https://investor.apple.com',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'coll-19',
    category: 'collision',
    userPrompt: 'Download annual filings from https://investor.apple.com and put them in ~/Stocks/Apple',
    expectedSkillId: 'download-and-organize',
  },
  {
    id: 'coll-20',
    category: 'collision',
    userPrompt: 'Check out https://github.com/trending and summarize the top repositories',
    expectedSkillId: 'research-website',
  },
  {
    id: 'coll-21',
    category: 'collision',
    userPrompt: 'Extract the table of top repositories from https://github.com/trending',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'coll-22',
    category: 'collision',
    userPrompt: 'Submit contact form on https://service.com/contact with my inquiry',
    expectedSkillId: 'fill-web-form',
  },
  {
    id: 'coll-23',
    category: 'collision',
    userPrompt: 'Look for identical files in my Downloads folder',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'coll-24',
    category: 'collision',
    userPrompt: 'Sort the messy files in my Downloads folder',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'coll-25',
    category: 'collision',
    userPrompt: 'Locate where invoice_december.pdf is stored',
    expectedSkillId: 'find-files',
  },
  {
    id: 'coll-26',
    category: 'collision',
    userPrompt: 'Download whitepapers from https://aws.amazon.com/whitepapers and arrange them by topic in ~/AWS',
    expectedSkillId: 'download-and-organize',
  },
  {
    id: 'coll-27',
    category: 'collision',
    userPrompt: 'Research competitor features on https://product.com and save markdown report to ~/CompAnalysis.md',
    expectedSkillId: 'research-and-save-report',
  },
  {
    id: 'coll-28',
    category: 'collision',
    userPrompt: 'Scrape product catalog table with prices from https://store.com',
    expectedSkillId: 'extract-website-data',
  },
  {
    id: 'coll-29',
    category: 'collision',
    userPrompt: 'Download all product catalogs as PDFs from https://store.com/catalogs',
    expectedSkillId: 'download-documents',
  },
  {
    id: 'coll-30',
    category: 'collision',
    userPrompt: 'Fill in job application fields on https://careers.tech.com/apply',
    expectedSkillId: 'fill-web-form',
  },
  {
    id: 'coll-31',
    category: 'collision',
    userPrompt: 'Batch rename all downloaded files to prefix 2026_',
    expectedSkillId: 'bulk-rename',
  },
  {
    id: 'coll-32',
    category: 'collision',
    userPrompt: 'Organize all downloaded files by file extension',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'coll-33',
    category: 'collision',
    userPrompt: 'Find all documents modified this year in ~/Documents',
    expectedSkillId: 'find-files',
  },
  {
    id: 'coll-34',
    category: 'collision',
    userPrompt: 'Find duplicate video clips in ~/Videos',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'coll-35',
    category: 'collision',
    userPrompt: 'Research https://wikipedia.org/wiki/Artificial_intelligence and save summary report to ~/AI.txt',
    expectedSkillId: 'research-and-save-report',
  },

  // =========================================================================
  // 3. FALSE POSITIVES & UNSUPPORTED REQUESTS (35 cases) -> Must be rejected!
  // =========================================================================
  {
    id: 'false-01',
    category: 'false_positive',
    userPrompt: 'Help me plan my taxes for 2024.',
    expectedSkillId: null,
  },
  {
    id: 'false-02',
    category: 'false_positive',
    userPrompt: 'Write an email to John apologizing for the delay in the project.',
    expectedSkillId: null,
  },
  {
    id: 'false-03',
    category: 'false_positive',
    userPrompt: 'Book me a flight from New York to London next Friday.',
    expectedSkillId: null,
  },
  {
    id: 'false-04',
    category: 'false_positive',
    userPrompt: 'Analyze this Excel spreadsheet and calculate total revenue by region.',
    expectedSkillId: null,
  },
  {
    id: 'false-05',
    category: 'false_positive',
    userPrompt: 'Edit this image to remove the background.',
    expectedSkillId: null,
  },
  {
    id: 'false-06',
    category: 'false_positive',
    userPrompt: 'Translate this paragraph into French and Spanish.',
    expectedSkillId: null,
  },
  {
    id: 'false-07',
    category: 'false_positive',
    userPrompt: 'Generate a creative poem about autumn leaves and rain.',
    expectedSkillId: null,
  },
  {
    id: 'false-08',
    category: 'false_positive',
    userPrompt: 'Order a large pepperoni pizza from Domino’s.',
    expectedSkillId: null,
  },
  {
    id: 'false-09',
    category: 'false_positive',
    userPrompt: 'Play some jazz music playlist on Spotify.',
    expectedSkillId: null,
  },
  {
    id: 'false-10',
    category: 'false_positive',
    userPrompt: 'Tell me a funny joke about software engineers.',
    expectedSkillId: null,
  },
  {
    id: 'false-11',
    category: 'false_positive',
    userPrompt: 'Can you solve this second-order differential equation for me?',
    expectedSkillId: null,
  },
  {
    id: 'false-12',
    category: 'false_positive',
    userPrompt: 'Create a PowerPoint presentation with 10 slides about quantum computing.',
    expectedSkillId: null,
  },
  {
    id: 'false-13',
    category: 'false_positive',
    userPrompt: 'Convert this MP4 video file to MP3 audio.',
    expectedSkillId: null,
  },
  {
    id: 'false-14',
    category: 'false_positive',
    userPrompt: 'Check my Google Calendar schedule for tomorrow afternoon.',
    expectedSkillId: null,
  },
  {
    id: 'false-15',
    category: 'false_positive',
    userPrompt: 'Draft a legal non-disclosure agreement contract for consulting.',
    expectedSkillId: null,
  },
  {
    id: 'false-16',
    category: 'false_positive',
    userPrompt: 'Set a timer for 15 minutes while I bake cookies.',
    expectedSkillId: null,
  },
  {
    id: 'false-17',
    category: 'false_positive',
    userPrompt: 'Explain the difference between special and general relativity.',
    expectedSkillId: null,
  },
  {
    id: 'false-18',
    category: 'false_positive',
    userPrompt: 'What is the current weather forecast in Tokyo right now?',
    expectedSkillId: null,
  },
  {
    id: 'false-19',
    category: 'false_positive',
    userPrompt: 'Debug this Python TypeError exception in my code snippet.',
    expectedSkillId: null,
  },
  {
    id: 'false-20',
    category: 'false_positive',
    userPrompt: 'Refactor this React component from class syntax to functional hooks.',
    expectedSkillId: null,
  },
  {
    id: 'false-21',
    category: 'false_positive',
    userPrompt: 'Format my hard drive and reinstall Windows.',
    expectedSkillId: null,
  },
  {
    id: 'false-22',
    category: 'false_positive',
    userPrompt: 'Send $500 to Alice via PayPal or Venmo.',
    expectedSkillId: null,
  },
  {
    id: 'false-23',
    category: 'false_positive',
    userPrompt: 'Order groceries on Instacart with milk, eggs, and bread.',
    expectedSkillId: null,
  },
  {
    id: 'false-24',
    category: 'false_positive',
    userPrompt: 'Give me healthy dinner recipe ideas using chicken and broccoli.',
    expectedSkillId: null,
  },
  {
    id: 'false-25',
    category: 'false_positive',
    userPrompt: 'Write a unit test in Go for this HTTP handler function.',
    expectedSkillId: null,
  },
  {
    id: 'false-26',
    category: 'false_positive',
    userPrompt: 'Calculate monthly mortgage payments on a $400,000 loan at 6.5%.',
    expectedSkillId: null,
  },
  {
    id: 'false-27',
    category: 'false_positive',
    userPrompt: 'Design a modern logo graphic for my new coffee shop brand.',
    expectedSkillId: null,
  },
  {
    id: 'false-28',
    category: 'false_positive',
    userPrompt: 'Transcribe this voice audio memo into written text.',
    expectedSkillId: null,
  },
  {
    id: 'false-29',
    category: 'false_positive',
    userPrompt: 'Summarize the key points of this 20-minute YouTube video link.',
    expectedSkillId: null,
  },
  {
    id: 'false-30',
    category: 'false_positive',
    userPrompt: 'What is the capital city of Australia?',
    expectedSkillId: null,
  },
  {
    id: 'false-31',
    category: 'false_positive',
    userPrompt: 'Help me compose an apology message to send on Slack.',
    expectedSkillId: null,
  },
  {
    id: 'false-32',
    category: 'false_positive',
    userPrompt: 'Turn on the living room lights via smart home.',
    expectedSkillId: null,
  },
  {
    id: 'false-33',
    category: 'false_positive',
    userPrompt: 'Generate a random secure 16-character password.',
    expectedSkillId: null,
  },
  {
    id: 'false-34',
    category: 'false_positive',
    userPrompt: 'Can you teach me how to play chess openings?',
    expectedSkillId: null,
  },
  {
    id: 'false-35',
    category: 'false_positive',
    userPrompt: 'Convert 500 US Dollars to Japanese Yen.',
    expectedSkillId: null,
  },

  // =========================================================================
  // 4. PARAMETER EXTRACTION (35 cases)
  // =========================================================================
  {
    id: 'param-01',
    category: 'parameter',
    userPrompt: 'Find all PDFs named invoice in my Downloads folder.',
    expectedSkillId: 'find-files',
    expectedInputs: {
      directory: '~/Downloads',
      pattern: 'invoice',
      extension: 'pdf',
    },
  },
  {
    id: 'param-02',
    category: 'parameter',
    userPrompt: 'Find *.log files in /var/log',
    expectedSkillId: 'find-files',
    expectedInputs: {
      directory: '/var/log',
      pattern: '*.log',
    },
  },
  {
    id: 'param-03',
    category: 'parameter',
    userPrompt: 'Find contract documents in C:/Users/Raaz/Documents',
    expectedSkillId: 'find-files',
    expectedInputs: {
      directory: 'C:/Users/Raaz/Documents',
      pattern: 'contract',
    },
  },
  {
    id: 'param-04',
    category: 'parameter',
    userPrompt: 'Find all spreadsheet xlsx files in ~/Desktop/Accounting',
    expectedSkillId: 'find-files',
    expectedInputs: {
      directory: '~/Desktop/Accounting',
      extension: 'xlsx',
    },
  },
  {
    id: 'param-05',
    category: 'parameter',
    userPrompt: 'Organize my Downloads folder by fileType',
    expectedSkillId: 'organize-downloads',
    expectedInputs: {
      folder: '~/Downloads',
      groupBy: 'fileType',
    },
  },
  {
    id: 'param-06',
    category: 'parameter',
    userPrompt: 'Organize ~/Desktop/MessyFolder by date',
    expectedSkillId: 'organize-downloads',
    expectedInputs: {
      folder: '~/Desktop/MessyFolder',
      groupBy: 'date',
    },
  },
  {
    id: 'param-07',
    category: 'parameter',
    userPrompt: 'Organize ~/Downloads',
    expectedSkillId: 'organize-downloads',
    expectedInputs: {
      folder: '~/Downloads',
      groupBy: 'extension', // default
    },
  },
  {
    id: 'param-08',
    category: 'parameter',
    userPrompt: 'Organize C:/Users/Raaz/Downloads folder',
    expectedSkillId: 'organize-downloads',
    expectedInputs: {
      folder: 'C:/Users/Raaz/Downloads',
      groupBy: 'extension',
    },
  },
  {
    id: 'param-09',
    category: 'parameter',
    userPrompt: 'Find duplicate files in ~/Downloads',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: {
      folder: '~/Downloads',
    },
  },
  {
    id: 'param-10',
    category: 'parameter',
    userPrompt: 'Check duplicate files in C:/Photos',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: {
      folder: 'C:/Photos',
    },
  },
  {
    id: 'param-11',
    category: 'parameter',
    userPrompt: 'Check for duplicates in ~/Documents/Projects',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: {
      folder: '~/Documents/Projects',
    },
  },
  {
    id: 'param-12',
    category: 'parameter',
    userPrompt: 'Rename files in ~/Screenshots using pattern shot_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: {
      folder: '~/Screenshots',
      pattern: 'shot_',
    },
  },
  {
    id: 'param-13',
    category: 'parameter',
    userPrompt: 'Bulk rename files in C:/Photos with prefix photo_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: {
      folder: 'C:/Photos',
      pattern: 'photo_',
    },
  },
  {
    id: 'param-14',
    category: 'parameter',
    userPrompt: 'Rename screenshots in ~/Desktop/Screenshots by date',
    expectedSkillId: 'bulk-rename',
    expectedInputs: {
      folder: '~/Desktop/Screenshots',
      pattern: 'date',
    },
  },
  {
    id: 'param-15',
    category: 'parameter',
    userPrompt: 'Research website https://openai.com',
    expectedSkillId: 'research-website',
    expectedInputs: {
      url: 'https://openai.com',
      maxPages: 1, // default
    },
  },
  {
    id: 'param-16',
    category: 'parameter',
    userPrompt: 'Research https://stripe.com with depth 2',
    expectedSkillId: 'research-website',
    expectedInputs: {
      url: 'https://stripe.com',
      maxPages: 2,
    },
  },
  {
    id: 'param-17',
    category: 'parameter',
    userPrompt: 'Browse https://anthropic.com and research company',
    expectedSkillId: 'research-website',
    expectedInputs: {
      url: 'https://anthropic.com',
    },
  },
  {
    id: 'param-18',
    category: 'parameter',
    userPrompt: 'Extract product names and prices from https://store.example.com/products',
    expectedSkillId: 'extract-website-data',
    expectedInputs: {
      url: 'https://store.example.com/products',
    },
  },
  {
    id: 'param-19',
    category: 'parameter',
    userPrompt: 'Scrape table data from https://data.gov/tables/census',
    expectedSkillId: 'extract-website-data',
    expectedInputs: {
      url: 'https://data.gov/tables/census',
    },
  },
  {
    id: 'param-20',
    category: 'parameter',
    userPrompt: 'Download all PDF reports from https://company.com/investor-relations into ~/Reports',
    expectedSkillId: 'download-documents',
    expectedInputs: {
      url: 'https://company.com/investor-relations',
      fileExtension: '.pdf',
      targetDirectory: '~/Reports',
    },
  },
  {
    id: 'param-21',
    category: 'parameter',
    userPrompt: 'Download documents from https://docs.example.com/manuals into ~/Downloads',
    expectedSkillId: 'download-documents',
    expectedInputs: {
      url: 'https://docs.example.com/manuals',
      fileExtension: '.pdf', // default
      targetDirectory: '~/Downloads',
    },
  },
  {
    id: 'param-22',
    category: 'parameter',
    userPrompt: 'Download csv files from https://open-data.org/datasets to ~/Datasets',
    expectedSkillId: 'download-documents',
    expectedInputs: {
      url: 'https://open-data.org/datasets',
      fileExtension: '.csv',
      targetDirectory: '~/Datasets',
    },
  },
  {
    id: 'param-23',
    category: 'parameter',
    userPrompt: 'Fill form at https://example.com/apply with name John and email john@example.com',
    expectedSkillId: 'fill-web-form',
    expectedInputs: {
      url: 'https://example.com/apply',
    },
  },
  {
    id: 'param-24',
    category: 'parameter',
    userPrompt: 'Fill contact form on https://company.com/contact',
    expectedSkillId: 'fill-web-form',
    expectedInputs: {
      url: 'https://company.com/contact',
    },
  },
  {
    id: 'param-25',
    category: 'parameter',
    userPrompt: 'Download reports from https://sec.gov and sort them into ~/Finance',
    expectedSkillId: 'download-and-organize',
    expectedInputs: {
      url: 'https://sec.gov',
      destinationFolder: '~/Finance',
    },
  },
  {
    id: 'param-26',
    category: 'parameter',
    userPrompt: 'Download all whitepapers from https://cloud.org/whitepapers and arrange them in ~/CloudDocs',
    expectedSkillId: 'download-and-organize',
    expectedInputs: {
      url: 'https://cloud.org/whitepapers',
      destinationFolder: '~/CloudDocs',
    },
  },
  {
    id: 'param-27',
    category: 'parameter',
    userPrompt: 'Research Tesla at https://tesla.com and save report to ~/Documents/tesla.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: {
      url: 'https://tesla.com',
      topic: 'Tesla',
      outputFilePath: '~/Documents/tesla.md',
    },
  },
  {
    id: 'param-28',
    category: 'parameter',
    userPrompt: 'Research Microsoft at https://microsoft.com and save report to ~/Reports/microsoft.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: {
      url: 'https://microsoft.com',
      topic: 'Microsoft',
      outputFilePath: '~/Reports/microsoft.md',
    },
  },
  {
    id: 'param-29',
    category: 'parameter',
    userPrompt: 'Research https://github.com and save summary to ~/github.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: {
      url: 'https://github.com',
      outputFilePath: '~/github.md',
    },
  },
  {
    id: 'param-30',
    category: 'parameter',
    userPrompt: 'Find all docx files containing resume in ~/Work',
    expectedSkillId: 'find-files',
    expectedInputs: {
      directory: '~/Work',
      pattern: 'resume',
      extension: 'docx',
    },
  },
  {
    id: 'param-31',
    category: 'parameter',
    userPrompt: 'Organize ~/Desktop by fileType',
    expectedSkillId: 'organize-downloads',
    expectedInputs: {
      folder: '~/Desktop',
      groupBy: 'fileType',
    },
  },
  {
    id: 'param-32',
    category: 'parameter',
    userPrompt: 'Check duplicate files in /home/user/music',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: {
      folder: '/home/user/music',
    },
  },
  {
    id: 'param-33',
    category: 'parameter',
    userPrompt: 'Rename screenshots in ~/Pictures/Screenshots with pattern date',
    expectedSkillId: 'bulk-rename',
    expectedInputs: {
      folder: '~/Pictures/Screenshots',
      pattern: 'date',
    },
  },
  {
    id: 'param-34',
    category: 'parameter',
    userPrompt: 'Download documents from https://federalreserve.gov/releases into ~/FedData',
    expectedSkillId: 'download-documents',
    expectedInputs: {
      url: 'https://federalreserve.gov/releases',
      targetDirectory: '~/FedData',
    },
  },
  {
    id: 'param-35',
    category: 'parameter',
    userPrompt: 'Research https://arxiv.org/abs/2301.00001 and save report to ~/PaperSummary.txt',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: {
      url: 'https://arxiv.org/abs/2301.00001',
      outputFilePath: '~/PaperSummary.txt',
    },
  },

  // =========================================================================
  // 5. CONTEXT-DEPENDENT & AMBIGUITY / CLARIFICATION (25 cases)
  // =========================================================================
  {
    id: 'ctx-01',
    category: 'context',
    userPrompt: 'Organize this folder.',
    expectedSkillId: 'organize-downloads',
    context: { activeDirectory: '~/Downloads' },
    expectedInputs: { folder: '~/Downloads' },
  },
  {
    id: 'ctx-02',
    category: 'context',
    userPrompt: 'Organize this folder.',
    expectedSkillId: 'organize-downloads',
    // WITHOUT context -> must ask user for folder
    expectMissingInputs: ['folder'],
  },
  {
    id: 'ctx-03',
    category: 'context',
    userPrompt: 'Find duplicate files in this folder.',
    expectedSkillId: 'duplicate-detection',
    context: { activeDirectory: '~/Documents' },
    expectedInputs: { folder: '~/Documents' },
  },
  {
    id: 'ctx-04',
    category: 'context',
    userPrompt: 'Find duplicate files.',
    expectedSkillId: 'duplicate-detection',
    // WITHOUT context -> must ask for folder
    expectMissingInputs: ['folder'],
  },
  {
    id: 'ctx-05',
    category: 'context',
    userPrompt: 'Download all PDF reports from this page.',
    expectedSkillId: 'download-documents',
    context: { activeBrowserUrl: 'https://annualreports.com/company/apple' },
    expectedInputs: { url: 'https://annualreports.com/company/apple' },
  },
  {
    id: 'ctx-06',
    category: 'context',
    userPrompt: 'Download all PDF reports.',
    expectedSkillId: 'download-documents',
    // WITHOUT URL in prompt or browser context -> must ask for url
    expectMissingInputs: ['url'],
  },
  {
    id: 'ctx-07',
    category: 'context',
    userPrompt: 'Research this website.',
    expectedSkillId: 'research-website',
    context: { activeBrowserUrl: 'https://stripe.com' },
    expectedInputs: { url: 'https://stripe.com' },
  },
  {
    id: 'ctx-08',
    category: 'context',
    userPrompt: 'Research this website.',
    expectedSkillId: 'research-website',
    // WITHOUT browser context -> must ask for url
    expectMissingInputs: ['url'],
  },
  {
    id: 'ctx-09',
    category: 'context',
    userPrompt: 'Extract all product names and prices from this page.',
    expectedSkillId: 'extract-website-data',
    context: { activeBrowserUrl: 'https://shop.example.com/items' },
    expectedInputs: { url: 'https://shop.example.com/items' },
  },
  {
    id: 'ctx-10',
    category: 'context',
    userPrompt: 'Extract all product names and prices.',
    expectedSkillId: 'extract-website-data',
    // WITHOUT browser context -> must ask for url
    expectMissingInputs: ['url'],
  },
  {
    id: 'ctx-11',
    category: 'ambiguous',
    userPrompt: 'Rename these files.',
    expectedSkillId: 'bulk-rename',
    // Both folder and pattern are missing! Must NOT invent a naming pattern or folder!
    expectMissingInputs: ['folder', 'pattern'],
  },
  {
    id: 'ctx-12',
    category: 'context',
    userPrompt: 'Rename these files using pattern shot_',
    expectedSkillId: 'bulk-rename',
    context: { activeDirectory: '~/Screenshots' },
    expectedInputs: { folder: '~/Screenshots', pattern: 'shot_' },
  },
  {
    id: 'ctx-13',
    category: 'ambiguous',
    userPrompt: 'Rename these files using pattern backup_',
    expectedSkillId: 'bulk-rename',
    // folder missing without activeDirectory
    expectMissingInputs: ['folder'],
  },
  {
    id: 'ctx-14',
    category: 'ambiguous',
    userPrompt: 'Rename files in ~/Screenshots.',
    expectedSkillId: 'bulk-rename',
    // pattern missing! Must ask for pattern
    expectMissingInputs: ['pattern'],
  },
  {
    id: 'ctx-15',
    category: 'ambiguous',
    userPrompt: 'Download the documents.',
    expectedSkillId: 'download-documents',
    expectMissingInputs: ['url'],
  },
  {
    id: 'ctx-16',
    category: 'context',
    userPrompt: 'Find all PDF files.',
    expectedSkillId: 'find-files',
    context: { activeDirectory: '~/Documents' },
    expectedInputs: { directory: '~/Documents', extension: 'pdf' },
  },
  {
    id: 'ctx-17',
    category: 'ambiguous',
    userPrompt: 'Find all PDF files.',
    expectedSkillId: 'find-files',
    // without context -> must ask for directory
    expectMissingInputs: ['directory'],
  },
  {
    id: 'ctx-18',
    category: 'context',
    userPrompt: 'Fill in this application form with my details.',
    expectedSkillId: 'fill-web-form',
    context: { activeBrowserUrl: 'https://jobs.example.com/apply' },
    expectedInputs: { url: 'https://jobs.example.com/apply' },
  },
  {
    id: 'ctx-19',
    category: 'context',
    userPrompt: 'Research this company and save a summary report to ~/Documents/summary.md',
    expectedSkillId: 'research-and-save-report',
    context: {
      activeBrowserUrl: 'https://anthropic.com',
      activeBrowserTitle: 'Anthropic AI',
    },
    expectedInputs: {
      url: 'https://anthropic.com',
      outputFilePath: '~/Documents/summary.md',
    },
  },
  {
    id: 'ctx-20',
    category: 'context',
    userPrompt: 'Download these reports and organize them into ~/Finance',
    expectedSkillId: 'download-and-organize',
    context: { activeBrowserUrl: 'https://sec.gov/edgar' },
    expectedInputs: {
      url: 'https://sec.gov/edgar',
      destinationFolder: '~/Finance',
    },
  },
  {
    id: 'ctx-21',
    category: 'ambiguous',
    userPrompt: 'clean my files',
    // Highly ambiguous! Could be organize or duplicate or cleanup.
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'ctx-22',
    category: 'ambiguous',
    userPrompt: 'sort these',
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'ctx-23',
    category: 'ambiguous',
    userPrompt: 'find the document',
    expectedSkillId: 'find-files',
  },
  {
    id: 'ctx-24',
    category: 'ambiguous',
    userPrompt: 'check duplicate copies',
    expectedSkillId: 'duplicate-detection',
  },
  {
    id: 'ctx-25',
    category: 'ambiguous',
    userPrompt: 'scrape the table from this page',
    expectedSkillId: 'extract-website-data',
    context: { activeBrowserUrl: 'https://stats.gov/tables' },
    expectedInputs: { url: 'https://stats.gov/tables' },
  },
]
