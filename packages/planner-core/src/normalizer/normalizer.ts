// Normalizer

import type { NormalizedInput, NormalizedEntity } from '@usepilot/planner-types'

// Entity detection patterns

const URL_PATTERN = /https?:\/\/[^\s]+/g
const EMAIL_PATTERN = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g
const FILEPATH_PATTERN_WIN = /[A-Za-z]:\\[^\s"<>|?*:]+/g
const FILEPATH_PATTERN_UNIX = /(?:\/[^\s"<>|?*:]+){2,}/g
const CURRENCY_PATTERN = /(?:₹|Rs\.?|INR|USD|\$|€|£)\s?\d[\d,]*(?:\.\d{1,2})?|\d[\d,]*(?:\.\d{1,2})?\s*(?:rupees?|dollars?|euros?)/gi

// Relative date expressions → ISO date string normalization
const RELATIVE_DATE_MAP: Record<string, () => string> = {
  today: () => new Date().toISOString().split('T')[0] ?? new Date().toISOString(),
  tomorrow: () => {
    const d = new Date()
    d.setDate(d.getDate() + 1)
    return d.toISOString().split('T')[0] ?? d.toISOString()
  },
  yesterday: () => {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    return d.toISOString().split('T')[0] ?? d.toISOString()
  },
  'next week': () => {
    const d = new Date()
    d.setDate(d.getDate() + 7)
    return d.toISOString().split('T')[0] ?? d.toISOString()
  },
  'last month': () => {
    const d = new Date()
    d.setMonth(d.getMonth() - 1)
    return d.toISOString().split('T')[0] ?? d.toISOString()
  },
  'this year': () => `${new Date().getFullYear()}`,
  'last year': () => `${new Date().getFullYear() - 1}`,
}

// Basic language detection — covers the most common non-English scripts
const NON_ENGLISH_RANGES = [
  /[\u0900-\u097F]/, // Devanagari (Hindi, Marathi, etc.)
  /[\u0600-\u06FF]/, // Arabic
  /[\u4E00-\u9FFF]/, // CJK (Chinese, Japanese, Korean)
  /[\uAC00-\uD7AF]/, // Korean Hangul
  /[\u0400-\u04FF]/, // Cyrillic
]

function detectLanguage(text: string): string {
  for (const range of NON_ENGLISH_RANGES) {
    if (range.test(text)) return 'non-en'
  }
  return 'en'
}

// Normalizer

export class Normalizer {
  normalize(rawText: string): NormalizedInput {
    const start = Date.now()
    const entities: NormalizedEntity[] = []

    // 1. Collapse whitespace, trim
    let text = rawText
      .replace(/\r\n/g, '\n')
      .replace(/\t/g, ' ')
      .replace(/[ ]{2,}/g, ' ')
      .trim()

    // 2. Normalize relative dates (done before other entity tagging)
    for (const [expr, resolver] of Object.entries(RELATIVE_DATE_MAP)) {
      const re = new RegExp(`\\b${expr}\\b`, 'gi')
      text = text.replace(re, (match, offset) => {
        const normalized = resolver()
        entities.push({
          type: 'date',
          raw: match,
          normalized,
          startOffset: offset as number,
          endOffset: (offset as number) + normalized.length,
        })
        return normalized
      })
    }

    // 3. Tag URLs
    this.tagPattern(text, URL_PATTERN, 'url', entities, (raw) => raw)

    // 4. Tag email addresses
    this.tagPattern(text, EMAIL_PATTERN, 'email', entities, (raw) => raw.toLowerCase())

    // 5. Tag file paths (Windows-style)
    this.tagPattern(text, FILEPATH_PATTERN_WIN, 'filepath', entities, (raw) =>
      raw.replace(/\\/g, '/')
    )

    // 6. Tag file paths (Unix-style)
    this.tagPattern(text, FILEPATH_PATTERN_UNIX, 'filepath', entities, (raw) => raw)

    // 7. Tag currency amounts
    this.tagPattern(text, CURRENCY_PATTERN, 'currency', entities, (raw) => raw.trim())

    // 8. Remove duplicate overlapping entities
    const deduped = this.deduplicateEntities(entities)

    return {
      text,
      originalText: rawText,
      detectedLanguage: detectLanguage(rawText),
      entities: deduped,
      durationMs: Date.now() - start,
    }
  }

  private tagPattern(
    text: string,
    pattern: RegExp,
    type: NormalizedEntity['type'],
    entities: NormalizedEntity[],
    normalize: (raw: string) => string
  ): void {
    pattern.lastIndex = 0
    let match: RegExpExecArray | null
    while ((match = pattern.exec(text)) !== null) {
      const raw = match[0]
      const startOffset = match.index
      const normalized = normalize(raw)
      entities.push({
        type,
        raw,
        normalized,
        startOffset,
        endOffset: startOffset + normalized.length,
      })
    }
  }

  private deduplicateEntities(entities: NormalizedEntity[]): NormalizedEntity[] {
    // Sort by start offset, then remove any that overlap with a previous one
    const sorted = [...entities].sort((a, b) => a.startOffset - b.startOffset)
    const result: NormalizedEntity[] = []
    let lastEnd = -1
    for (const entity of sorted) {
      if (entity.startOffset >= lastEnd) {
        result.push(entity)
        lastEnd = entity.endOffset
      }
    }
    return result
  }
}
