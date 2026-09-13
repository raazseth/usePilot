import type { SkillRuntimeContextSnapshot } from '@usepilot/skill-types'

export interface HoldoutScenario {
  id: string
  category: 'colloquial' | 'context' | 'typos_synonyms' | 'collision_compound' | 'unsupported_negative'
  userPrompt: string
  expectedSkillId: string | null
  context?: SkillRuntimeContextSnapshot | undefined
  expectedInputs?: Record<string, unknown> | undefined
  expectMissingInputs?: string[] | undefined
  allowClarification?: boolean | undefined
}

/**
 * BLIND HOLDOUT VALIDATION CORPUS (110 Unseen Scenarios)
 * 
 * Specifically designed to test generalization on natural human language
 * that was NOT present in the training/development matrix.
 */
export const HOLDOUT_CORPUS: HoldoutScenario[] = [
  // =========================================================================
  // 1. COLLOQUIAL & DESCRIPTIVE HUMAN REQUESTS (20 cases)
  // =========================================================================
  {
    id: 'hold-col-01',
    category: 'colloquial',
    userPrompt: "There's a bunch of junk sitting where my downloads normally land. Sort it.",
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: '~/Downloads' },
  },
  {
    id: 'hold-col-02',
    category: 'colloquial',
    userPrompt: 'Can you hunt down the billing PDFs somewhere in my documents?',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Documents', extension: 'pdf' },
  },
  {
    id: 'hold-col-03',
    category: 'colloquial',
    userPrompt: 'Are any of these files exact copies of each other in ~/Desktop/Dump?',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Desktop/Dump' },
  },
  {
    id: 'hold-col-04',
    category: 'colloquial',
    userPrompt: 'Pull the reports off this investor relations page https://ir.acme.com/sec-filings into ~/Reports',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://ir.acme.com/sec-filings', targetDirectory: '~/Reports' },
  },
  {
    id: 'hold-col-05',
    category: 'colloquial',
    userPrompt: 'Go through this site https://brand.store and tell me what products they sell.',
    expectedSkillId: 'research-website',
    expectedInputs: { url: 'https://brand.store' },
  },
  {
    id: 'hold-col-06',
    category: 'colloquial',
    userPrompt: 'I have way too many messy screenshots on my Desktop, please group them by date.',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: '~/Desktop', groupBy: 'date' },
  },
  {
    id: 'hold-col-07',
    category: 'colloquial',
    userPrompt: 'Check which items in ~/Music have identical audio checksums or contents',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Music' },
  },
  {
    id: 'hold-col-08',
    category: 'colloquial',
    userPrompt: 'Search my disk for anything related to lease agreements in C:/Users/Raaz/Legal',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: 'C:/Users/Raaz/Legal' },
  },
  {
    id: 'hold-col-09',
    category: 'colloquial',
    userPrompt: 'Harvest the pricing table from https://cloudrates.io/servers',
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://cloudrates.io/servers' },
  },
  {
    id: 'hold-col-10',
    category: 'colloquial',
    userPrompt: 'Sign me up for an account on https://service.org/register with username devRaaz',
    expectedSkillId: 'fill-web-form',
    expectedInputs: { url: 'https://service.org/register' },
  },
  {
    id: 'hold-col-11',
    category: 'colloquial',
    userPrompt: 'Tidy up all the clutter in C:/Users/Raaz/Downloads',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: 'C:/Users/Raaz/Downloads' },
  },
  {
    id: 'hold-col-12',
    category: 'colloquial',
    userPrompt: 'Find any spread sheet xlsx files in my Documents folder',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Documents', extension: 'xlsx' },
  },
  {
    id: 'hold-col-13',
    category: 'colloquial',
    userPrompt: 'Relabel every photo in ~/Pictures/Trip to prefix vacation_2025_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Pictures/Trip', pattern: 'vacation_2025_' },
  },
  {
    id: 'hold-col-14',
    category: 'colloquial',
    userPrompt: 'Inspect https://news.ycombinator.com and give me an executive brief saved at ~/news.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: { url: 'https://news.ycombinator.com', outputFilePath: '~/news.md' },
  },
  {
    id: 'hold-col-15',
    category: 'colloquial',
    userPrompt: 'Snag all the PDF whitepapers from https://research.org/papers into ~/Papers',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://research.org/papers', targetDirectory: '~/Papers' },
  },
  {
    id: 'hold-col-16',
    category: 'colloquial',
    userPrompt: 'Fetch balance sheets from https://sec.gov/edgar and organize them into ~/Finance',
    expectedSkillId: 'download-and-organize',
    expectedInputs: { url: 'https://sec.gov/edgar', destinationFolder: '~/Finance' },
  },
  {
    id: 'hold-col-17',
    category: 'colloquial',
    userPrompt: 'Look through ~/Archives for repeated duplicate zip bundles',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Archives' },
  },
  {
    id: 'hold-col-18',
    category: 'colloquial',
    userPrompt: 'Track down my passport scan in ~/Documents',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Documents' },
  },
  {
    id: 'hold-col-19',
    category: 'colloquial',
    userPrompt: 'Scrape stock quotes from https://marketdata.com/stocks',
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://marketdata.com/stocks' },
  },
  {
    id: 'hold-col-20',
    category: 'colloquial',
    userPrompt: 'Batch rename the pictures in ~/Screenshots by date',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Screenshots', pattern: 'date' },
  },

  // =========================================================================
  // 2. CONTEXT-DEPENDENT & DEICTIC REFERENCES (20 cases)
  // =========================================================================
  {
    id: 'hold-ctx-01',
    category: 'context',
    userPrompt: 'Clean this up.',
    expectedSkillId: 'organize-downloads',
    context: { activeDirectory: '~/Downloads' },
    expectedInputs: { folder: '~/Downloads' },
  },
  {
    id: 'hold-ctx-02',
    category: 'context',
    userPrompt: 'Clean this up.',
    expectedSkillId: 'organize-downloads',
    // Missing active directory -> MUST ask user, NOT guess C:\ or ~/Desktop!
    expectMissingInputs: ['folder'],
  },
  {
    id: 'hold-ctx-03',
    category: 'context',
    userPrompt: 'Grab that PDF and save it into ~/Documents',
    expectedSkillId: 'download-documents',
    context: { activeBrowserUrl: 'https://example.com/spec.pdf' },
    expectedInputs: { url: 'https://example.com/spec.pdf', targetDirectory: '~/Documents' },
  },
  {
    id: 'hold-ctx-04',
    category: 'context',
    userPrompt: 'Grab that PDF.',
    expectedSkillId: 'download-documents',
    // No URL in context -> must ask for URL
    expectMissingInputs: ['url'],
  },
  {
    id: 'hold-ctx-05',
    category: 'context',
    userPrompt: 'Are there clones in here?',
    expectedSkillId: 'duplicate-detection',
    context: { activeDirectory: '~/Pictures' },
    expectedInputs: { folder: '~/Pictures' },
  },
  {
    id: 'hold-ctx-06',
    category: 'context',
    userPrompt: 'Are there clones in here?',
    expectedSkillId: 'duplicate-detection',
    // No context directory -> must ask
    expectMissingInputs: ['folder'],
  },
  {
    id: 'hold-ctx-07',
    category: 'context',
    userPrompt: 'Change all these file names to start with draft_',
    expectedSkillId: 'bulk-rename',
    context: { activeDirectory: '~/Articles' },
    expectedInputs: { folder: '~/Articles', pattern: 'draft_' },
  },
  {
    id: 'hold-ctx-08',
    category: 'context',
    userPrompt: 'Change all these file names to start with draft_',
    expectedSkillId: 'bulk-rename',
    // Missing folder context -> must ask for folder
    expectMissingInputs: ['folder'],
  },
  {
    id: 'hold-ctx-09',
    category: 'context',
    userPrompt: 'Find where the quarterly budget file is.',
    expectedSkillId: 'find-files',
    context: { activeDirectory: '~/Finance' },
    expectedInputs: { directory: '~/Finance' },
  },
  {
    id: 'hold-ctx-10',
    category: 'context',
    userPrompt: 'Find where the quarterly budget file is.',
    expectedSkillId: 'find-files',
    // Missing directory context -> must ask for directory
    expectMissingInputs: ['directory'],
  },
  {
    id: 'hold-ctx-11',
    category: 'context',
    userPrompt: 'Scrape the pricing table on this page.',
    expectedSkillId: 'extract-website-data',
    context: { activeBrowserUrl: 'https://store.company.com/catalog' },
    expectedInputs: { url: 'https://store.company.com/catalog' },
  },
  {
    id: 'hold-ctx-12',
    category: 'context',
    userPrompt: 'Scrape the pricing table on this page.',
    expectedSkillId: 'extract-website-data',
    // No browser URL in context -> must ask
    expectMissingInputs: ['url'],
  },
  {
    id: 'hold-ctx-13',
    category: 'context',
    userPrompt: 'Submit my details on this form.',
    expectedSkillId: 'fill-web-form',
    context: { activeBrowserUrl: 'https://portal.service.com/contact' },
    expectedInputs: { url: 'https://portal.service.com/contact' },
  },
  {
    id: 'hold-ctx-14',
    category: 'context',
    userPrompt: 'Submit my details on this form.',
    expectedSkillId: 'fill-web-form',
    expectMissingInputs: ['url'],
  },
  {
    id: 'hold-ctx-15',
    category: 'context',
    userPrompt: 'Research this company and write a markdown summary to ~/company.md',
    expectedSkillId: 'research-and-save-report',
    context: {
      activeBrowserUrl: 'https://linear.app',
      activeBrowserTitle: 'Linear Issue Tracking',
    },
    expectedInputs: { url: 'https://linear.app', outputFilePath: '~/company.md' },
  },
  {
    id: 'hold-ctx-16',
    category: 'context',
    userPrompt: 'Download the documents on this site into ~/Downloads',
    expectedSkillId: 'download-documents',
    context: { activeBrowserUrl: 'https://irs.gov/publications' },
    expectedInputs: { url: 'https://irs.gov/publications', targetDirectory: '~/Downloads' },
  },
  {
    id: 'hold-ctx-17',
    category: 'context',
    userPrompt: 'Download these invoices and sort them into ~/Accounting',
    expectedSkillId: 'download-and-organize',
    context: { activeBrowserUrl: 'https://vendor.org/invoices' },
    expectedInputs: { url: 'https://vendor.org/invoices', destinationFolder: '~/Accounting' },
  },
  {
    id: 'hold-ctx-18',
    category: 'context',
    userPrompt: 'Organize this folder by file extension.',
    expectedSkillId: 'organize-downloads',
    context: { activeDirectory: '~/Projects/Mess' },
    expectedInputs: { folder: '~/Projects/Mess', groupBy: 'extension' },
  },
  {
    id: 'hold-ctx-19',
    category: 'context',
    userPrompt: 'Find any duplicate videos in this folder.',
    expectedSkillId: 'duplicate-detection',
    context: { activeDirectory: '~/Movies' },
    expectedInputs: { folder: '~/Movies' },
  },
  {
    id: 'hold-ctx-20',
    category: 'context',
    userPrompt: 'What does this website do?',
    expectedSkillId: 'research-website',
    context: { activeBrowserUrl: 'https://modal.com' },
    expectedInputs: { url: 'https://modal.com' },
  },

  // =========================================================================
  // 3. UNSEEN TYPOS & SEMANTIC VARIATIONS (20 cases)
  // =========================================================================
  {
    id: 'hold-var-01',
    category: 'typos_synonyms',
    userPrompt: 'organise my downlods', // unseen typo 'downlods'
    expectedSkillId: 'organize-downloads',
  },
  {
    id: 'hold-var-02',
    category: 'typos_synonyms',
    userPrompt: 'find invoce documents in ~/Documents', // unseen typo 'invoce'
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Documents' },
  },
  {
    id: 'hold-var-03',
    category: 'typos_synonyms',
    userPrompt: 'reasearch this company https://stripe.com', // unseen typo 'reasearch'
    expectedSkillId: 'research-website',
    expectedInputs: { url: 'https://stripe.com' },
  },
  {
    id: 'hold-var-04',
    category: 'typos_synonyms',
    userPrompt: 'duplciate photos in ~/Pictures', // unseen typo 'duplciate'
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Pictures' },
  },
  {
    id: 'hold-var-05',
    category: 'typos_synonyms',
    userPrompt: 'renam files in ~/Photos with prefix summer_', // unseen typo 'renam'
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Photos', pattern: 'summer_' },
  },
  {
    id: 'hold-var-06',
    category: 'typos_synonyms',
    userPrompt: 'extarct tables from https://example.com/data', // unseen typo 'extarct'
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://example.com/data' },
  },
  {
    id: 'hold-var-07',
    category: 'typos_synonyms',
    userPrompt: 'tidy up the directory C:/Work/OldFiles',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: 'C:/Work/OldFiles' },
  },
  {
    id: 'hold-var-08',
    category: 'typos_synonyms',
    userPrompt: 'gather every single receipt docx in ~/Receipts',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Receipts', extension: 'docx' },
  },
  {
    id: 'hold-var-09',
    category: 'typos_synonyms',
    userPrompt: 'hunt for identical files across ~/Videos',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Videos' },
  },
  {
    id: 'hold-var-10',
    category: 'typos_synonyms',
    userPrompt: 'relabel screenshots in ~/Pictures with prefix holiday_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Pictures', pattern: 'holiday_' },
  },
  {
    id: 'hold-var-11',
    category: 'typos_synonyms',
    userPrompt: 'fetch documents from https://docs.org into ~/Docs',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://docs.org', targetDirectory: '~/Docs' },
  },
  {
    id: 'hold-var-12',
    category: 'typos_synonyms',
    userPrompt: 'browse through https://vercel.com/docs and summarize',
    expectedSkillId: 'research-website',
    expectedInputs: { url: 'https://vercel.com/docs' },
  },
  {
    id: 'hold-var-13',
    category: 'typos_synonyms',
    userPrompt: 'find all spreadsheets in ~/Accounting',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Accounting' },
  },
  {
    id: 'hold-var-14',
    category: 'typos_synonyms',
    userPrompt: 'detect duplicate songs in ~/Music',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Music' },
  },
  {
    id: 'hold-var-15',
    category: 'typos_synonyms',
    userPrompt: 'arrange files in ~/Downloads by date',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: '~/Downloads', groupBy: 'date' },
  },
  {
    id: 'hold-var-16',
    category: 'typos_synonyms',
    userPrompt: 'scrape catalog items from https://store.com/all',
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://store.com/all' },
  },
  {
    id: 'hold-var-17',
    category: 'typos_synonyms',
    userPrompt: 'fill out registration at https://forum.org/signup',
    expectedSkillId: 'fill-web-form',
    expectedInputs: { url: 'https://forum.org/signup' },
  },
  {
    id: 'hold-var-18',
    category: 'typos_synonyms',
    userPrompt: 'downlaod statements from https://bank.org to ~/Statements',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://bank.org', targetDirectory: '~/Statements' },
  },
  {
    id: 'hold-var-19',
    category: 'typos_synonyms',
    userPrompt: 'find redundant copies in ~/Documents',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Documents' },
  },
  {
    id: 'hold-var-20',
    category: 'typos_synonyms',
    userPrompt: 'prefix files in ~/Exports with export_2025_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Exports', pattern: 'export_2025_' },
  },

  // =========================================================================
  // 4. COLLISIONS & INTENT DISAMBIGUATION (25 cases)
  // =========================================================================
  {
    id: 'hold-col-21',
    category: 'collision_compound',
    userPrompt: 'Find all invoice PDFs in Downloads',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Downloads', extension: 'pdf' },
  },
  {
    id: 'hold-col-22',
    category: 'collision_compound',
    userPrompt: 'Find duplicate invoice PDFs in Downloads',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Downloads' },
  },
  {
    id: 'hold-col-23',
    category: 'collision_compound',
    userPrompt: 'Download invoice PDFs from https://billing.com/invoices into ~/Downloads',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://billing.com/invoices', targetDirectory: '~/Downloads' },
  },
  {
    id: 'hold-col-24',
    category: 'collision_compound',
    userPrompt: 'Download invoice PDFs from https://billing.com/invoices and sort them into ~/Finance',
    expectedSkillId: 'download-and-organize',
    expectedInputs: { url: 'https://billing.com/invoices', destinationFolder: '~/Finance' },
  },
  {
    id: 'hold-col-25',
    category: 'collision_compound',
    userPrompt: 'Organize invoice PDFs in ~/Downloads by date',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: '~/Downloads', groupBy: 'date' },
  },
  {
    id: 'hold-col-26',
    category: 'collision_compound',
    userPrompt: 'Rename invoice PDFs in ~/Downloads using pattern inv_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Downloads', pattern: 'inv_' },
  },
  {
    id: 'hold-col-27',
    category: 'collision_compound',
    userPrompt: 'Research competitor at https://competitor.com',
    expectedSkillId: 'research-website',
    expectedInputs: { url: 'https://competitor.com' },
  },
  {
    id: 'hold-col-28',
    category: 'collision_compound',
    userPrompt: 'Research competitor at https://competitor.com and save the report to ~/competitor.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: { url: 'https://competitor.com', outputFilePath: '~/competitor.md' },
  },
  {
    id: 'hold-col-29',
    category: 'collision_compound',
    userPrompt: 'Scrape pricing tiers from https://competitor.com/pricing',
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://competitor.com/pricing' },
  },
  {
    id: 'hold-col-30',
    category: 'collision_compound',
    userPrompt: 'Submit inquiry form at https://competitor.com/contact',
    expectedSkillId: 'fill-web-form',
    expectedInputs: { url: 'https://competitor.com/contact' },
  },
  {
    id: 'hold-col-31',
    category: 'collision_compound',
    userPrompt: 'Locate all log files in /var/log',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '/var/log' },
  },
  {
    id: 'hold-col-32',
    category: 'collision_compound',
    userPrompt: 'Identify identical log files in /var/log',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '/var/log' },
  },
  {
    id: 'hold-col-33',
    category: 'collision_compound',
    userPrompt: 'Download logs from https://server.com/logs into ~/Logs',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://server.com/logs', targetDirectory: '~/Logs' },
  },
  {
    id: 'hold-col-34',
    category: 'collision_compound',
    userPrompt: 'Download system logs from https://server.com/logs and arrange them into ~/Logs/Archive',
    expectedSkillId: 'download-and-organize',
    expectedInputs: { url: 'https://server.com/logs', destinationFolder: '~/Logs/Archive' },
  },
  {
    id: 'hold-col-35',
    category: 'collision_compound',
    userPrompt: 'Check for identical pictures in ~/Photos',
    expectedSkillId: 'duplicate-detection',
    expectedInputs: { folder: '~/Photos' },
  },
  {
    id: 'hold-col-36',
    category: 'collision_compound',
    userPrompt: 'Find pictures named trip in ~/Photos',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Photos' },
  },
  {
    id: 'hold-col-37',
    category: 'collision_compound',
    userPrompt: 'Rename trip photos in ~/Photos to trip_2025_',
    expectedSkillId: 'bulk-rename',
    expectedInputs: { folder: '~/Photos', pattern: 'trip_2025_' },
  },
  {
    id: 'hold-col-38',
    category: 'collision_compound',
    userPrompt: 'Sort trip photos in ~/Photos by date',
    expectedSkillId: 'organize-downloads',
    expectedInputs: { folder: '~/Photos', groupBy: 'date' },
  },
  {
    id: 'hold-col-39',
    category: 'collision_compound',
    userPrompt: 'Extract table of exchange rates from https://fx.com/rates',
    expectedSkillId: 'extract-website-data',
    expectedInputs: { url: 'https://fx.com/rates' },
  },
  {
    id: 'hold-col-40',
    category: 'collision_compound',
    userPrompt: 'Research FX trends at https://fx.com/insights and output summary to ~/fx.md',
    expectedSkillId: 'research-and-save-report',
    expectedInputs: { url: 'https://fx.com/insights', outputFilePath: '~/fx.md' },
  },
  {
    id: 'hold-col-41',
    category: 'collision_compound',
    userPrompt: 'Download FX daily PDF statements from https://fx.com/statements into ~/Statements',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://fx.com/statements', targetDirectory: '~/Statements' },
  },
  {
    id: 'hold-col-42',
    category: 'collision_compound',
    userPrompt: 'Find PDF files on https://arxiv.org/list/cs/recent',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://arxiv.org/list/cs/recent' },
  },
  {
    id: 'hold-col-43',
    category: 'collision_compound',
    userPrompt: 'Find all PDF files in ~/Desktop/Research',
    expectedSkillId: 'find-files',
    expectedInputs: { directory: '~/Desktop/Research', extension: 'pdf' },
  },
  {
    id: 'hold-col-44',
    category: 'collision_compound',
    userPrompt: 'Read through https://github.com/trending and summarize the top repositories',
    expectedSkillId: 'research-website',
    expectedInputs: { url: 'https://github.com/trending' },
  },
  {
    id: 'hold-col-45',
    category: 'collision_compound',
    userPrompt: 'Download repository releases from https://github.com/user/project/releases to ~/Releases',
    expectedSkillId: 'download-documents',
    expectedInputs: { url: 'https://github.com/user/project/releases', targetDirectory: '~/Releases' },
  },

  // =========================================================================
  // 5. UNSEEN OUT-OF-DOMAIN / UNSUPPORTED REQUESTS (25 cases)
  // Must NOT force-fit into any Skill! Must return null / no candidate!
  // =========================================================================
  {
    id: 'hold-neg-01',
    category: 'unsupported_negative',
    userPrompt: 'Can you review my resume and suggest improvements for a senior SWE role?',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-02',
    category: 'unsupported_negative',
    userPrompt: "Play Beethoven's Symphony No. 9 on Spotify.",
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-03',
    category: 'unsupported_negative',
    userPrompt: 'Translate this Spanish paragraph into German.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-04',
    category: 'unsupported_negative',
    userPrompt: 'Debug this TypeScript stack overflow error in my express server handler.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-05',
    category: 'unsupported_negative',
    userPrompt: 'What time zone is Tokyo in compared to London?',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-06',
    category: 'unsupported_negative',
    userPrompt: 'Write a poem about autumn leaves falling in Paris.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-07',
    category: 'unsupported_negative',
    userPrompt: 'Help me formulate a 4-day workout routine for muscle hypertrophy.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-08',
    category: 'unsupported_negative',
    userPrompt: 'Solve this quadratic equation: 3x^2 + 5x - 8 = 0.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-09',
    category: 'unsupported_negative',
    userPrompt: 'Book a reservation for two at French Laundry this Saturday at 7pm.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-10',
    category: 'unsupported_negative',
    userPrompt: 'Generate a CSS gradient with pastel cyan and lavender.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-11',
    category: 'unsupported_negative',
    userPrompt: 'Explain the technical differences between TCP and UDP networking protocols.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-12',
    category: 'unsupported_negative',
    userPrompt: 'Draft a polite termination notice letter for an independent contractor.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-13',
    category: 'unsupported_negative',
    userPrompt: 'Optimize this slow SQL query that joins five tables in PostgreSQL.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-14',
    category: 'unsupported_negative',
    userPrompt: 'Order a large pepperoni pizza on Dominoes with garlic dipping sauce.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-15',
    category: 'unsupported_negative',
    userPrompt: 'What is the weather forecast for Seattle tomorrow afternoon?',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-16',
    category: 'unsupported_negative',
    userPrompt: 'Create a slide deck outline for our upcoming Q4 investor pitch.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-17',
    category: 'unsupported_negative',
    userPrompt: 'Teach me how to play basic open guitar chords like G, C, and D.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-18',
    category: 'unsupported_negative',
    userPrompt: 'Convert this local MP3 podcast file to 16kHz WAV format.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-19',
    category: 'unsupported_negative',
    userPrompt: 'Send a WhatsApp message to Sarah saying that our meeting is pushed back.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-20',
    category: 'unsupported_negative',
    userPrompt: 'What are the proven scientific health benefits of drinking green tea daily?',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-21',
    category: 'unsupported_negative',
    userPrompt: 'Draft a residential lease agreement for a two-bedroom apartment in Brooklyn.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-22',
    category: 'unsupported_negative',
    userPrompt: 'Calculate the compound interest on a $10,000 investment at 7% over 10 years.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-23',
    category: 'unsupported_negative',
    userPrompt: 'Write a bash script that builds and pushes a Docker image to AWS ECR.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-24',
    category: 'unsupported_negative',
    userPrompt: 'Compare camera sensor specifications between iPhone 16 Pro and Pixel 9 Pro.',
    expectedSkillId: null,
  },
  {
    id: 'hold-neg-25',
    category: 'unsupported_negative',
    userPrompt: 'Plan a 4-day travel itinerary for exploring cultural landmarks in Kyoto.',
    expectedSkillId: null,
  },
]
