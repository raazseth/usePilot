/**
 * Deterministic NLP Normalizer, Lemmatizer & Intent Disambiguator for Skill Discovery.
 * 
 * Provides:
 * - Canonical root mapping for action verbs & domain concepts
 * - Suffix stemming (-s, -es, -ed, -ing, -tion)
 * - Single-character typo tolerance
 * - Domain discrimination (web vs local filesystem vs cross-runtime)
 * - Specialized concept weights (e.g. "duplicate" vs generic "find")
 */

// Common user synonyms mapped to canonical intent concepts
const CONCEPT_SYNONYMS: Record<string, string> = {
  // Organize concept
  organise: 'organize',
  organizing: 'organize',
  organization: 'organize',
  tidy: 'organize',
  tidying: 'organize',
  clean: 'organize',
  cleanup: 'organize',
  sort: 'organize',
  sorting: 'organize',
  arrange: 'organize',
  arranging: 'organize',
  categorize: 'organize',
  categorise: 'organize',

  // Find concept
  locate: 'find',
  locating: 'find',
  search: 'find',
  searching: 'find',
  seek: 'find',
  look: 'find',

  // Duplicate concept
  duplicates: 'duplicate',
  dupes: 'duplicate',
  dups: 'duplicate',
  identical: 'duplicate',
  copies: 'duplicate',
  clone: 'duplicate',
  clones: 'duplicate',
  redundant: 'duplicate',

  // Rename concept
  renaming: 'rename',
  retitle: 'rename',
  renmae: 'rename',
  relabel: 'rename',
  prefix: 'rename',

  // Download concept
  downlaod: 'download',
  downlaods: 'downloads',
  downloading: 'download',
  grab: 'download',
  grabbing: 'download',
  snag: 'download',
  fetch: 'download',
  fetching: 'download',
  save: 'download',

  // Research / Browse concept
  reaserch: 'research',
  researching: 'research',
  investigate: 'research',
  investigating: 'research',
  browse: 'research',
  browsing: 'research',
  overview: 'research',
  inspect: 'research',

  // Web Extract concept
  scrape: 'extract',
  scraping: 'extract',
  scraper: 'extract',
  harvest: 'extract',
  tabular: 'extract',
  table: 'extract',
  tables: 'extract',
  prices: 'extract',
  pricing: 'extract',
  catalog: 'extract',

  // Form concept
  form: 'form',
  forms: 'form',
  apply: 'form',
  application: 'form',
  signup: 'form',
  registration: 'form',
  survey: 'form',
  inquiry: 'form',
  contact: 'form',

  // Find concept
  hunt: 'find',
  gather: 'find',
  track: 'find',

  // Organize concept
  group: 'organize',
  cluster: 'organize',

  // Common nouns & typos
  invoise: 'invoice',
  invoices: 'invoice',
  receipts: 'invoice',
  bills: 'invoice',
  duplicat: 'duplicate',
}

const TARGET_KEYWORDS = ['download', 'downloads', 'invoice', 'duplicate', 'research', 'rename', 'extract', 'organize']

function isLevenshtein1(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false
  let diff = 0
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (a[i] !== b[j]) {
      diff++
      if (diff > 1) return false
      if (a.length > b.length) {
        i++
        continue
      } else if (b.length > a.length) {
        j++
        continue
      }
    }
    i++
    j++
  }
  return true
}

// Suffix rules for English words
function stripSuffix(word: string): string {
  if (word.length <= 4) return word
  if (word.endsWith('ing') && word.length > 5) return word.slice(0, -3)
  if (word.endsWith('tion') && word.length > 6) return word.slice(0, -4)
  if (word.endsWith('ment') && word.length > 6) return word.slice(0, -4)
  if (word.endsWith('ies') && word.length > 5) return word.slice(0, -3) + 'y'
  if (word.endsWith('es') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('ed') && word.length > 4) return word.slice(0, -2)
  if (word.endsWith('s') && !word.endsWith('ss') && word.length > 3) return word.slice(0, -1)
  return word
}

/**
 * Normalizes and lemmatizes raw user tokens.
 */
export function normalizeToken(token: string): string {
  const lower = token.toLowerCase().trim()
  if (CONCEPT_SYNONYMS[lower]) {
    return CONCEPT_SYNONYMS[lower]!
  }
  if (lower.length >= 5) {
    for (const target of TARGET_KEYWORDS) {
      if (isLevenshtein1(lower, target)) {
        return target === 'downloads' ? 'download' : target
      }
    }
  }
  return stripSuffix(lower)
}

/**
 * Tokenizes text into normalized, lemmatized tokens.
 */
export function tokenizeNormalized(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/https?:\/\/[^\s]+/g, ' __url__ ')
    .replace(/[^a-z0-9_\s-]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1)
    .map(normalizeToken)
}

/**
 * Analyzes domain signals and intent indicators from the user prompt.
 */
export const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
  'my', 'your', 'our', 'all', 'any', 'this', 'that', 'these', 'those', 'is', 'are', 'was', 'be',
  'me', 'you', 'it', 'we', 'they', '__url__'
])

export interface PromptSignals {
  hasUrl: boolean
  hasWebKeyword: boolean
  hasFilesystemKeyword: boolean
  hasCrossRuntimeKeywords: boolean
  hasCrossDownloadAndOrganize: boolean
  hasCrossResearchAndSave: boolean
  hasDuplicateSignal: boolean
  hasRenameSignal: boolean
  hasOrganizeSignal: boolean
  hasFormSignal: boolean
  hasExtractSignal: boolean
  hasDownloadSignal: boolean
  hasResearchSignal: boolean
  hasFindSignal: boolean
  hasWebDocumentSignal: boolean
  isDatabaseQuery: boolean
  normalizedTokens: string[]
}

export function extractPromptSignals(rawPrompt: string): PromptSignals {
  const lower = rawPrompt.toLowerCase()
  const hasUrl = /https?:\/\/[^\s]+/.test(rawPrompt)
  const normalizedTokens = tokenizeNormalized(rawPrompt)

  const webKeywords = ['website', 'webpage', 'site', 'url', 'online', 'web', 'page', 'browse', 'internet', '__url__']
  const hasWebKeyword = hasUrl || webKeywords.some((w) => lower.includes(w) || normalizedTokens.includes(w))

  // Download action signal: exclude pure folder references like "my downloads folder" unless "download" is an action verb
  const isOnlyDownloadsFolder = /^(?:organize|clean up|tidy|sort)\s+(?:my\s+)?downloads(?:\s+folder|\s+directory)?/i.test(rawPrompt.trim()) ||
    /\b(?:in|into|of)\s+(?:my\s+)?downloads(?:\s+folder|\s+directory)?/i.test(rawPrompt) ||
    /downloads\s+folder/i.test(rawPrompt)
  const hasDownloadSignal = (normalizedTokens.includes('download') || /\b(download|downlaod|grab|fetch)\b/i.test(rawPrompt)) &&
    (!isOnlyDownloadsFolder || /\b(download|grab|fetch)\s+(?:all\s+)?(?:the\s+)?(?:pdf|reports|documents|files)\b/i.test(rawPrompt))

  const fsKeywords = hasDownloadSignal
    ? ['folder', 'directory', 'disk', 'desktop', 'pictures', 'photos', 'screenshot', 'screenshots']
    : ['folder', 'directory', 'disk', 'file', 'files', 'desktop', 'documents', 'downloads', 'pictures', 'photos', 'screenshot', 'screenshots']
  const hasFilesystemKeyword = fsKeywords.some((k) => lower.includes(k) || normalizedTokens.includes(k))

  const hasDuplicateSignal = normalizedTokens.includes('duplicate') || /\b(duplicate|duplicates|identical|dupes|clone|clones)\b/i.test(rawPrompt)
  const hasRenameSignal = normalizedTokens.includes('rename') || /\b(rename|renmae|relabel|prefix)\b/i.test(rawPrompt) || /\b(change|modify)\s+(?:all\s+)?(?:these\s+)?file\s+names\b/i.test(rawPrompt)
  const hasOrganizeSignal = normalizedTokens.includes('organize') || /\b(organize|organise|clean up|tidy|sort|group|cluster)\b/i.test(rawPrompt)
  const hasFormSignal = normalizedTokens.includes('form') || /\b(form|forms|apply|signup|sign up|sign me up|registration|register)\b/i.test(rawPrompt)

  const isDatabaseQuery = /\b(sql|query|postgres|postgresql|database|joins|indexes)\b/i.test(rawPrompt) && !hasUrl
  const hasExtractSignal = !isDatabaseQuery && ((normalizedTokens.includes('extract') || /\b(scrape|tabular|table|prices|pricing|harvest)\b/i.test(rawPrompt)) && !/\b(pdf|download)\b/i.test(rawPrompt))

  const hasResearchSignal =
    normalizedTokens.includes('research') ||
    /\b(research|reaserch|overview|investigate)\b/i.test(rawPrompt) ||
    /\b(look through|check out|explore|browse|go through|inspect)\s+(?:this\s+)?(?:website|webpage|page|site|https?:\/\/)/i.test(rawPrompt) ||
    (hasUrl && /\b(summarize|overview|analyze|tell me about|what is on|check out|brief)\b/i.test(rawPrompt)) ||
    (hasWebKeyword && /\b(summarize\s+what\s+this\s+(?:business|company|website|site)|tell\s+me\s+what\s+(?:products|they|this)|what\s+does\s+this\s+(?:website|site)\s+do)\b/i.test(rawPrompt))

  const hasDocumentNoun = /\b(invoice|invoices|receipt|receipts|contract|contracts|resume|statement|statements|paper|papers|report|reports|pdf|pdfs|docx?|xlsx?)\b/i.test(rawPrompt)
  const hasFindSignal =
    ((normalizedTokens.includes('find') || /\b(find|locate|search for|look for|where is|need all the|hunt down|gather|track down)\b/i.test(rawPrompt)) &&
     !/\blook through\s+(?:this\s+)?(?:website|page|site)\b/i.test(rawPrompt)) ||
    (hasDocumentNoun && hasFilesystemKeyword)

  // Web document seeking intent (e.g. "Find PDFs on this website", "Download reports from https://...")
  const hasWebDocumentSignal =
    (hasUrl || hasWebKeyword || /\b(this\s+site|this\s+page|that\s+page)\b/i.test(rawPrompt)) &&
    (hasDownloadSignal || /\b(pull|snag|find|get|fetch|grab|save)\s+(?:all\s+)?(?:available\s+)?(?:the\s+)?(?:pdf|pdfs|documents|reports|whitepapers|manuals|papers)\b/i.test(rawPrompt) || /\b(pdf|pdfs|reports)\s+on\s+(?:this\s+)?(?:website|page|site)\b/i.test(rawPrompt))

  // Cross-runtime download and organize requires a web source OR compound intent + download action + organize action
  const hasCrossDownloadAndOrganize =
    (hasUrl || hasWebKeyword || hasWebDocumentSignal || /\b(those|these)\b/i.test(rawPrompt)) &&
    hasDownloadSignal &&
    /\b(organize|organise|somewhere organized|sort|arrange|put)\b/i.test(rawPrompt)

  // Cross-runtime research and save requires research + saving report to local disk
  const hasCrossResearchAndSave =
    hasResearchSignal &&
    /\b(save|write|output|export)\b/i.test(rawPrompt) &&
    /\b(report|summary|file|disk|\.md|\.txt)\b/i.test(rawPrompt)

  const hasCrossRuntimeKeywords = hasCrossDownloadAndOrganize || hasCrossResearchAndSave

  return {
    hasUrl,
    hasWebKeyword,
    hasFilesystemKeyword,
    hasCrossRuntimeKeywords,
    hasCrossDownloadAndOrganize,
    hasCrossResearchAndSave,
    hasDuplicateSignal,
    hasRenameSignal,
    hasOrganizeSignal,
    hasFormSignal,
    hasExtractSignal,
    hasDownloadSignal,
    hasResearchSignal,
    hasFindSignal,
    hasWebDocumentSignal,
    isDatabaseQuery,
    normalizedTokens,
  }
}
