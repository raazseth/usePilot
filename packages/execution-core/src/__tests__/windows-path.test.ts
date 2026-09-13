import { describe, expect, it } from 'vitest'
import { WindowsPathNormalizer } from '../adapters/filesystem/windows-path'

describe('Windows Path Normalization & Safety (P0)', () => {
  const normalizer = new WindowsPathNormalizer({ workingDirectory: 'C:\\Users\\Raaz\\Desktop' })

  it('normalizes standard C:\\ and forward slash C:/ paths consistently', () => {
    const p1 = normalizer.normalizePath('C:\\Users\\Raaz\\Downloads\\file.txt')
    const p2 = normalizer.normalizePath('C:/Users/Raaz/Downloads/file.txt')
    const p3 = normalizer.normalizePath('c:/users/raaz/downloads/file.txt')

    expect(p1).toBe('C:\\Users\\Raaz\\Downloads\\file.txt')
    expect(p2).toBe('C:\\Users\\Raaz\\Downloads\\file.txt')
    expect(p3.startsWith('C:\\')).toBe(true)
  })

  it('handles UNC network paths (\\\\server\\share\\path)', () => {
    const unc1 = normalizer.normalizePath('\\\\nas-storage\\backup\\reports\\2025.xlsx')
    const unc2 = normalizer.normalizePath('//nas-storage/backup/reports/2025.xlsx')

    expect(unc1).toBe('\\\\nas-storage\\backup\\reports\\2025.xlsx')
    expect(unc2).toBe('\\\\nas-storage\\backup\\reports\\2025.xlsx')
  })

  it('preserves spaces, Unicode characters, and emojis in paths', () => {
    const unicodePath = normalizer.normalizePath('C:/Users/Raaz/Documents/📁 Work & Projects [2025] #1/📄 invoice_日本語_ñoño.pdf')
    expect(unicodePath).toContain('📁 Work & Projects [2025] #1')
    expect(unicodePath).toContain('📄 invoice_日本語_ñoño.pdf')
  })

  it('detects Windows reserved device names (CON, PRN, AUX, NUL, COM1-9, LPT1-9)', () => {
    expect(WindowsPathNormalizer.isReservedName('CON')).toBe(true)
    expect(WindowsPathNormalizer.isReservedName('con.txt')).toBe(true)
    expect(WindowsPathNormalizer.isReservedName('aux.tar.gz')).toBe(true)
    expect(WindowsPathNormalizer.isReservedName('NUL')).toBe(true)
    expect(WindowsPathNormalizer.isReservedName('com3.log')).toBe(true)
    expect(WindowsPathNormalizer.isReservedName('lpt1')).toBe(true)

    // Valid filenames containing substring but not reserved base
    expect(WindowsPathNormalizer.isReservedName('contact.pdf')).toBe(false)
    expect(WindowsPathNormalizer.isReservedName('auxiliary.docx')).toBe(false)
    expect(WindowsPathNormalizer.isReservedName('null_pointer.ts')).toBe(false)
  })

  it('rejects paths containing Windows reserved names as invalid', () => {
    const check1 = WindowsPathNormalizer.isValidPathSyntax('C:/Users/Raaz/Documents/CON.txt')
    const check2 = WindowsPathNormalizer.isValidPathSyntax('C:/Users/Raaz/AUX/data.csv')
    const check3 = WindowsPathNormalizer.isValidPathSyntax('C:/Users/Raaz/ValidFolder/report.pdf')

    expect(check1.valid).toBe(false)
    expect(check1.reason).toContain('reserved Windows device name')
    expect(check2.valid).toBe(false)
    expect(check3.valid).toBe(true)
  })

  it('sanitizes illegal Windows characters and reserved names', () => {
    const sanitized1 = WindowsPathNormalizer.sanitizeFilename('report:final*v1?.pdf')
    expect(sanitized1).toBe('report_final_v1_.pdf')

    const sanitized2 = WindowsPathNormalizer.sanitizeFilename('CON.txt')
    expect(sanitized2).toBe('_CON.txt')

    // Trims trailing dots and spaces
    const sanitized3 = WindowsPathNormalizer.sanitizeFilename('my file ...   ')
    expect(sanitized3).toBe('my file')
  })

  it('handles extended-length paths exceeding MAX_PATH (260 characters)', () => {
    const longSubdir = 'a'.repeat(200)
    const longFilename = 'b'.repeat(70) + '.txt'
    const veryLong = `C:/Users/Raaz/Documents/${longSubdir}/${longFilename}`

    const normalizedLong = normalizer.normalizePath(veryLong, { forceExtended: true })
    expect(normalizedLong.startsWith('\\\\?\\C:\\')).toBe(true)
    expect(normalizedLong.length).toBeGreaterThan(260)
  })
})
