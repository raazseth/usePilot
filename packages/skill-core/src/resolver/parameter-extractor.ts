import type { Skill, ResolutionContext } from '@usepilot/skill-types'

/**
 * Normalizes user-mentioned directory names (e.g. "Downloads", "my Documents") into canonical path strings.
 */
function normalizeFolderPath(rawPath: string): string {
  const trimmed = rawPath.trim().replace(/^my\s+/i, '').replace(/[\\/]$/, '')
  if (/^downloads$/i.test(trimmed)) return '~/Downloads'
  if (/^documents$/i.test(trimmed)) return '~/Documents'
  if (/^desktop$/i.test(trimmed)) return '~/Desktop'
  if (/^(?:pictures|photos)$/i.test(trimmed)) return '~/Pictures'
  if (/^screenshots$/i.test(trimmed)) return '~/Screenshots'
  if (/^finance$/i.test(trimmed)) return '~/Finance'
  if (/^accounting$/i.test(trimmed)) return '~/Accounting'
  if (/^reports$/i.test(trimmed)) return '~/Reports'
  if (/^datasets$/i.test(trimmed)) return '~/Datasets'
  if (/^feddata$/i.test(trimmed)) return '~/FedData'
  if (/^clouddocs$/i.test(trimmed)) return '~/CloudDocs'
  if (/^work$/i.test(trimmed)) return '~/Work'
  return trimmed.replace(/\\/g, '/')
}

/**
 * Deterministic Parameter Extractor.
 * Extracts skill parameters from natural language prompts and runtime context snapshots.
 */
export class SkillParameterExtractor {
  extract(
    skill: Skill,
    rawInputs: Record<string, unknown>,
    context: ResolutionContext
  ): Record<string, unknown> {
    const extracted: Record<string, unknown> = { ...rawInputs }
    const prompt = context.userPrompt?.trim() ?? ''
    const lower = prompt.toLowerCase()
    const rt = context.runtimeContext

    // 1. Extract URL (for browser & cross-runtime skills)
    if (skill.inputs['url'] && !extracted['url']) {
      const urlMatch = prompt.match(/https?:\/\/[^\s"',;>)]+/)
      if (urlMatch) {
        extracted['url'] = urlMatch[0]
      } else if (
        (lower.includes('this') || lower.includes('these') || lower.includes('that') || lower.includes('those') || lower.includes('here') || lower.includes('from this site') || lower.includes('from this page')) &&
        rt?.activeBrowserUrl
      ) {
        extracted['url'] = rt.activeBrowserUrl
      }
    }

    // 2. Extract Folder / Directory Paths (for filesystem & cross-runtime skills)
    // Check if the prompt references "this folder" / "this directory" / "these files" / "here" WITH context
    const hasThisFolderContext =
      lower.includes('this folder') ||
      lower.includes('this directory') ||
      lower.includes('these files') ||
      lower.includes('this page') ||
      lower.includes('here')

    // Find directory path for skills expecting folder or directory
    const hasFolderInput = Boolean(skill.inputs['folder'])
    const hasDirectoryInput = Boolean(skill.inputs['directory'])
    const hasTargetDirectoryInput = Boolean(skill.inputs['targetDirectory'])

    let resolvedFolder: string | undefined = undefined

    if (hasThisFolderContext) {
      if (rt?.activeDirectory) {
        resolvedFolder = normalizeFolderPath(rt.activeDirectory)
      } else {
        // Explicitly requesting "this folder" but context is absent -> leave undefined so missing_input is triggered!
        resolvedFolder = undefined
      }
    } else {
      // Check explicit absolute paths (Windows C:/..., Unix /..., or ~/) - not URLs!
      const explicitPathMatch = prompt.match(/(?:(?<![a-zA-Z])[a-zA-Z]:[\\/][^\s"',;>?)]+|(?:\/[a-zA-Z0-9_.-]+){2,}|~[\\/][^\s"',;>?)]+)/)
      if (explicitPathMatch && !explicitPathMatch[0].includes('://')) {
        resolvedFolder = normalizeFolderPath(explicitPathMatch[0].replace(/[?,.!;:]+$/, ''))
      } else {
        // Check named folders e.g. "in my Downloads folder", "in ~/Desktop", "in C:/Photos"
        const namedFolderMatch = prompt.match(/\b(?:in|into|of|from)\s+(?:my\s+)?([a-zA-Z]:[\\/][^\s"',;>?)]+|~[\\/][^\s"',;>?)]+|\/?(?:[a-zA-Z0-9_.-]+[\\/])*[a-zA-Z0-9_.-]+(?:\s+folder|\s+directory)?)/i)
        if (namedFolderMatch && namedFolderMatch[1]) {
          const candidate = namedFolderMatch[1].trim()
          if (!candidate.includes('://') && !candidate.startsWith('http')) {
            const cleaned = candidate.replace(/\s+(?:folder|directory)$/i, '').replace(/[?,.!;:]+$/, '').trim()
            if (!['this', 'these', 'that', 'those', 'a', 'the', 'my', 'all', 'any', 'junk', 'stuff', 'files', 'items', 'things'].includes(cleaned.toLowerCase())) {
              resolvedFolder = normalizeFolderPath(cleaned)
            }
          }
        }
        
        if (!resolvedFolder) {
          if (/\bdownloads\b/i.test(prompt) && !prompt.match(/https?:\/\/[^\s]+/)) {
            resolvedFolder = '~/Downloads'
          } else if (/\bdocuments\b/i.test(prompt) && !prompt.match(/https?:\/\/[^\s]+/)) {
            resolvedFolder = '~/Documents'
          } else if (/\bdesktop\b/i.test(prompt)) {
            resolvedFolder = '~/Desktop'
          } else if (/\bphotos\b|\bpictures\b/i.test(prompt)) {
            resolvedFolder = '~/Pictures'
          } else if (/\bscreenshots\b/i.test(prompt)) {
            resolvedFolder = '~/Screenshots'
          } else if (/\baccounting\b/i.test(prompt)) {
            resolvedFolder = '~/Accounting'
          } else if (rt?.activeDirectory) {
            resolvedFolder = normalizeFolderPath(rt.activeDirectory)
          }
        }
      }
    }

    if (resolvedFolder) {
      if (hasFolderInput && !extracted['folder']) extracted['folder'] = resolvedFolder
      if (hasDirectoryInput && !extracted['directory']) extracted['directory'] = resolvedFolder
      if (hasTargetDirectoryInput && !extracted['targetDirectory']) extracted['targetDirectory'] = resolvedFolder
    }

    // 3. Extract Destination Folder (for download-and-organize, organize-downloads)
    if (skill.inputs['destinationFolder'] && !extracted['destinationFolder']) {
      const destMatch = prompt.match(/\b(?:into|in|to)\s+(?:my\s+)?([a-zA-Z]:[\\/][^\s"',;>)]+|~[\\/][^\s"',;>)]+|Finance|BankStatements|Stocks(?:\/[^\s"',;>)]+)?|AWS|CloudDocs|Reports|Datasets)/i)
      if (destMatch && destMatch[1]) {
        extracted['destinationFolder'] = normalizeFolderPath(destMatch[1])
      }
    }

    // 4. Extract Download Folder (for download-documents)
    if ((skill.inputs['downloadFolder'] || skill.inputs['targetDirectory']) && (!extracted['downloadFolder'] || !extracted['targetDirectory'])) {
      const dlMatch = prompt.match(/\b(?:into|to|in)\s+([~/][^\s"',;>)]+|[a-zA-Z]:[\\/][^\s"',;>)]+|Reports|Datasets|Documents|FedData|Papers|CloudDocs)/i)
      if (dlMatch && dlMatch[1] && !['the', 'this'].includes(dlMatch[1].toLowerCase())) {
        const path = normalizeFolderPath(dlMatch[1])
        if (skill.inputs['downloadFolder']) extracted['downloadFolder'] = path
        if (skill.inputs['targetDirectory']) extracted['targetDirectory'] = path
      }
    }

    // 5. Extract GroupBy Strategy (for organize-downloads, download-and-organize)
    if (skill.inputs['groupBy'] && !extracted['groupBy']) {
      if (lower.includes('by date') || lower.includes('date')) {
        extracted['groupBy'] = 'date'
      } else if (lower.includes('filetype') || lower.includes('file type') || lower.includes('by type')) {
        extracted['groupBy'] = 'fileType'
      } else if (lower.includes('extension') || lower.includes('by extension')) {
        extracted['groupBy'] = 'extension'
      }
    }

    // 6. Extract Pattern / Naming Strategy (for find-files, bulk-rename-files)
    if (skill.inputs['pattern'] && !extracted['pattern']) {
      // Avoid matching literal syntax keywords
      const patternMatch = prompt.match(/\b(?:using pattern|using prefix|pattern|prefix|named|matching|containing|to)\s+([^\s"',;>)]+)/i)
      if (patternMatch && patternMatch[1]) {
        const val = patternMatch[1]
        if (!['by', 'using', 'files', 'these', 'pattern', 'prefix', 'date'].includes(val.toLowerCase())) {
          extracted['pattern'] = val
        } else if (val.toLowerCase() === 'pattern' || val.toLowerCase() === 'prefix') {
          // Check word after pattern/prefix
          const afterMatch = prompt.match(/\b(?:pattern|prefix)\s+([^\s"',;>)]+)/i)
          if (afterMatch && afterMatch[1]) extracted['pattern'] = afterMatch[1]
        }
      }

      if (!extracted['pattern']) {
        if (lower.includes('yyyy-mm-dd') || lower.includes('by date') || (skill.id === 'bulk-rename-files' && lower.includes('date'))) {
          extracted['pattern'] = 'date'
        } else if (skill.id === 'find-files') {
          const globMatch = prompt.match(/\*(\.[a-zA-Z0-9]+)/)
          if (globMatch) {
            extracted['pattern'] = `*${globMatch[1]}`
          } else {
            const searchNounMatch = prompt.match(/\b(?:find|search for|locate)\s+(?:all\s+)?([a-zA-Z0-9_-]+)\s+(?:files|documents|pdfs|receipts|invoices)/i)
            if (searchNounMatch && searchNounMatch[1] && !['all', 'pdf', 'the', 'my'].includes(searchNounMatch[1].toLowerCase())) {
              extracted['pattern'] = searchNounMatch[1]
            } else if (lower.includes('invoice')) {
              extracted['pattern'] = 'invoice'
            } else if (lower.includes('contract')) {
              extracted['pattern'] = 'contract'
            } else if (lower.includes('receipt')) {
              extracted['pattern'] = 'receipt'
            } else if (lower.includes('resume')) {
              extracted['pattern'] = 'resume'
            }
          }
        }
      }
    }

    // 7. Extract File Type / Extension (for find-files, download-documents)
    const promptWithoutUrls = prompt.replace(/https?:\/\/[^\s"',;>)]+/g, '')
    const extMatch = promptWithoutUrls.match(/\b(pdf|docx?|xlsx?|csv|png|jpe?g|txt|log|zip)s?\b/i)
    if (extMatch && extMatch[1]) {
      const ext = extMatch[1].toLowerCase()
      if (skill.inputs['fileType'] && !extracted['fileType']) extracted['fileType'] = ext
      if (skill.inputs['extension'] && !extracted['extension']) extracted['extension'] = ext
      if (skill.inputs['fileExtension'] && !extracted['fileExtension']) extracted['fileExtension'] = `.${ext}`
    }

    // 8. Extract Depth / MaxPages (for research-website)
    const depthMatch = prompt.match(/\b(?:depth|pages)\s+(\d+)\b/i)
    if (depthMatch && depthMatch[1]) {
      const num = parseInt(depthMatch[1], 10)
      if (skill.inputs['depth'] && extracted['depth'] === undefined) extracted['depth'] = num
      if (skill.inputs['maxPages'] && extracted['maxPages'] === undefined) extracted['maxPages'] = num
    }

    // 9. Extract Output File Path (for research-and-save-report)
    if (skill.inputs['outputFilePath'] && !extracted['outputFilePath']) {
      const outPathMatch = prompt.match(/\b(?:to|as)\s+([~/][^\s"',;>]+\.(?:md|txt)|[a-zA-Z]:[\\/][^\s"',;>]+\.(?:md|txt))/i)
      if (outPathMatch && outPathMatch[1]) {
        extracted['outputFilePath'] = normalizeFolderPath(outPathMatch[1])
      }
    }

    // 10. Extract Topic / Company (for research-and-save-report, research-website)
    const compMatch = prompt.match(/\b(?:research|about)\s+([A-Z][a-zA-Z0-9]+)\b/i)
    if (compMatch && compMatch[1] && !['The', 'This', 'All', 'My', 'Company', 'Website'].includes(compMatch[1])) {
      if (skill.inputs['companyOrTopic'] && !extracted['companyOrTopic']) extracted['companyOrTopic'] = compMatch[1]
      if (skill.inputs['topic'] && !extracted['topic']) extracted['topic'] = compMatch[1]
    } else if (rt?.activeBrowserTitle) {
      if (skill.inputs['companyOrTopic'] && !extracted['companyOrTopic']) extracted['companyOrTopic'] = rt.activeBrowserTitle
      if (skill.inputs['topic'] && !extracted['topic']) extracted['topic'] = rt.activeBrowserTitle
    }

    return extracted
  }
}
