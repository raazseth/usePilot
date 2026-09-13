import { isAbsolute, win32 } from 'node:path'

/**
 * Windows reserved device names (cannot be used as file or directory names in Windows,
 * even with an extension like AUX.txt or con.pdf).
 */
export const WINDOWS_RESERVED_NAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
])

/**
 * Windows illegal filename characters: < > : " / \ | ? * and ASCII control characters (0-31).
 */
// eslint-disable-next-line no-control-regex
export const WINDOWS_ILLEGAL_CHAR_REGEX = /[<>:"/\\|?*\x00-\x1F]/g

/**
 * Normalization options for Windows paths.
 */
export interface WindowsPathOptions {
  workingDirectory?: string
  enableExtendedPath?: boolean
}

export class WindowsPathNormalizer {
  private readonly cwd: string

  constructor(options?: WindowsPathOptions) {
    this.cwd = options?.workingDirectory ?? process.cwd()
  }

  /**
   * Checks whether a filename or segment matches a Windows reserved device name.
   * E.g. 'CON', 'con.txt', 'aux.tar.gz', 'com1.dat' all return true.
   */
  static isReservedName(fileNameOrSegment: string): boolean {
    const baseName = fileNameOrSegment.split('.')[0]?.trim().toUpperCase() ?? ''
    return WINDOWS_RESERVED_NAMES.has(baseName)
  }

  /**
   * Checks whether a path contains any segment with a Windows reserved device name.
   */
  static containsReservedName(filePath: string): boolean {
    const normalized = filePath.replace(/\\/g, '/')
    const segments = normalized.split('/')
    return segments.some((segment) => {
      const trimmed = segment.trim()
      if (!trimmed || trimmed === '.' || trimmed === '..') return false
      return WindowsPathNormalizer.isReservedName(trimmed)
    })
  }

  /**
   * Sanitizes a file or folder name so it is legal on Windows:
   * - Strips illegal characters: < > : " / \ | ? * and control chars
   * - Trims trailing dots and spaces
   * - Replaces Windows reserved names (e.g. CON -> _CON)
   */
  static sanitizeFilename(fileName: string, replacement = '_'): string {
    let sanitized = fileName.replace(WINDOWS_ILLEGAL_CHAR_REGEX, replacement)
    // Trim trailing dots and spaces which Windows automatically strips or rejects
    sanitized = sanitized.replace(/[. ]+$/, '')
    if (!sanitized) {
      sanitized = 'unnamed'
    }

    if (WindowsPathNormalizer.isReservedName(sanitized)) {
      sanitized = `${replacement}${sanitized}`
    }

    return sanitized
  }

  /**
   * Normalizes a file path into a canonical Windows path format:
   * - Unifies forward slashes into backslashes on Windows, or standard separators.
   * - Capitalizes drive letters (e.g. c:\ -> C:\).
   * - Preserves UNC paths (\\server\share\...).
   * - Preserves special characters (#, &, [, ], spaces, Unicode, emojis).
   * - Adds extended-length prefix (\\?\) for paths exceeding MAX_PATH (260 chars) on Windows.
   */
  normalizePath(rawPath: string, options?: { forceExtended?: boolean }): string {
    if (!rawPath || typeof rawPath !== 'string') {
      throw new Error('Path must be a non-empty string')
    }

    let p = rawPath.trim()

    // Handle user home expansion ~
    if (p === '~' || p.startsWith('~/') || p.startsWith('~\\')) {
      const home = process.env['USERPROFILE'] ?? process.env['HOME'] ?? this.cwd
      p = p === '~' ? home : win32.resolve(home, p.slice(2))
    }

    // Detect extended path prefix already present
    const isExtended = p.startsWith('\\\\?\\') || p.startsWith('//?/')

    // Detect UNC path: starts with \\ or // but not extended
    const isUnc = !isExtended && (p.startsWith('\\\\') || p.startsWith('//'))

    // Normalize slashes
    let normalized = p.replace(/\//g, '\\')

    if (!isAbsolute(normalized) && !isUnc && !isExtended) {
      normalized = win32.resolve(this.cwd, normalized)
    } else {
      normalized = win32.normalize(normalized)
    }

    // Capitalize drive letter if present (e.g., c:\ -> C:\)
    if (/^[a-zA-Z]:\\/.test(normalized)) {
      normalized = normalized[0]!.toUpperCase() + normalized.slice(1)
    }

    // For paths > 250 characters on Windows, apply extended length path prefix \\?\ if not already present
    const shouldExtend = options?.forceExtended || (process.platform === 'win32' && normalized.length >= 250)
    if (shouldExtend && !isExtended) {
      if (normalized.startsWith('\\\\')) {
        // UNC path: \\server\share -> \\?\UNC\server\share
        normalized = `\\\\?\\UNC\\${normalized.slice(2)}`
      } else if (/^[A-Z]:\\/i.test(normalized)) {
        // Local path: C:\path -> \\?\C:\path
        normalized = `\\\\?\\${normalized}`
      }
    }

    return normalized
  }

  /**
   * Validates if the path's root drive or device is syntactically valid.
   */
  static isValidPathSyntax(filePath: string): { valid: boolean; reason?: string } {
    if (!filePath || filePath.trim().length === 0) {
      return { valid: false, reason: 'Path is empty' }
    }

    if (WindowsPathNormalizer.containsReservedName(filePath)) {
      return { valid: false, reason: 'Path contains a reserved Windows device name (e.g. CON, PRN, AUX, NUL)' }
    }

    return { valid: true }
  }
}
