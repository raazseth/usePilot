# Normalizer

## Purpose

The `Normalizer` ensures the language model never sees raw, untamed user input strings. It runs before `GoalExtractor` as a deterministic, pure function with zero network or AI overhead.

## Schema Contract

```typescript
export interface NormalizedEntity {
  type: 'date' | 'time' | 'url' | 'email' | 'filepath' | 'currency' | 'person' | 'organization' | 'quantity'
  raw: string
  normalized: string
  startOffset: number
  endOffset: number
}

export interface NormalizedInput {
  text: string
  originalText: string
  detectedLanguage: string
  entities: NormalizedEntity[]
  durationMs: number
}
```

## Core Responsibilities

1. **Whitespace & Control Cleaning**: Replaces CRLF with LF, tabs with spaces, collapses repetitive whitespace, and trims edges.
2. **Relative Date Resolution**: Converts relative phrases (`today`, `tomorrow`, `yesterday`, `next week`, `last month`) into canonical ISO 8601 date strings.
3. **Named Entity Tagging**: Detects and extracts structured metadata:
   - URLs (`https://...`)
   - Email addresses
   - File paths (Windows `C:\...` and POSIX `/...`)
   - Currency & monetary values (`$250.00`, `€100`, `₹10,000`)
   - Quantities and numbers
4. **Script & Language Detection**: Detects non-English scripts (Devanagari, Cyrillic, CJK, Arabic) and attaches BCP 47 language tags.

