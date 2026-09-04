# Normalizer

## Purpose

The `Normalizer` ensures the language model never sees untamed, dirty raw user input. It runs before `GoalExtractor` as a deterministic, pure function with zero network or AI overhead.

## Responsibilities

1. **Whitespace & Control Cleaning**: Replaces CRLF with LF, tabs with spaces, collapses multiple whitespace characters, and trims edges.
2. **Relative Date Resolution**: Converts relative phrases (`today`, `tomorrow`, `yesterday`, `next week`, `last month`) into canonical ISO 8601 date strings.
3. **Named Entity Tagging**: Detects and extracts structured metadata:
   - URLs (`https://...`)
   - Email addresses
   - File paths (Windows `C:\...` and Unix `/...`)
   - Currency & monetary amounts (`$250.00`, `₹10,000`)
4. **Script & Language Detection**: Detects non-English unicode scripts (Devanagari, Cyrillic, CJK, Arabic) to assist downstream reasoning.
