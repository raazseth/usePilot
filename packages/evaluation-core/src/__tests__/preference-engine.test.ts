import { existsSync, unlinkSync } from 'node:fs'

import { describe, it, expect } from 'vitest'

import { PreferenceEngine } from '../personalization/preference-engine'

describe('PreferenceEngine — Personalization & Strict Precedence Hierarchy', () => {
  it('Case 1: uses safe default when no preference exists', () => {
    const engine = new PreferenceEngine()

    const result = engine.resolve({
      key: 'download_directory',
      explicitInput: undefined,
      systemSafetyPermitted: true,
      currentRuntimeValid: true,
      safeDefault: 'C:/Users/Default/Downloads',
    })

    expect(result.resolvedSource).toBe('SAFE_DEFAULT')
    expect(result.resolvedValue).toBe('C:/Users/Default/Downloads')
  })

  it('promotes candidate to validated only after repeated observation (threshold >= 3)', () => {
    const engine = new PreferenceEngine()

    // 1st observation -> CANDIDATE, LOW confidence
    const obs1 = engine.observe('download_directory', 'D:/Reports', 'user_execution')
    expect(obs1.status).toBe('CANDIDATE')
    expect(obs1.confidence).toBe('LOW')
    expect(obs1.observationCount).toBe(1)

    // 2nd observation -> CANDIDATE, MEDIUM confidence
    const obs2 = engine.observe('download_directory', 'D:/Reports', 'user_execution')
    expect(obs2.status).toBe('CANDIDATE')
    expect(obs2.confidence).toBe('MEDIUM')
    expect(obs2.observationCount).toBe(2)

    // Not yet applied because status is CANDIDATE, not VALIDATED
    const preValidation = engine.resolve({
      key: 'download_directory',
      systemSafetyPermitted: true,
      currentRuntimeValid: true,
      safeDefault: 'C:/Users/Default/Downloads',
    })
    expect(preValidation.resolvedSource).toBe('SAFE_DEFAULT')

    // 3rd observation -> VALIDATED, HIGH confidence
    const obs3 = engine.observe('download_directory', 'D:/Reports', 'user_execution')
    expect(obs3.status).toBe('VALIDATED')
    expect(obs3.confidence).toBe('HIGH')
    expect(obs3.observationCount).toBe(3)

    // Case 2: Validated preference applied
    const postValidation = engine.resolve({
      key: 'download_directory',
      systemSafetyPermitted: true,
      currentRuntimeValid: true,
      safeDefault: 'C:/Users/Default/Downloads',
    })
    expect(postValidation.resolvedSource).toBe('VALIDATED_PREFERENCE')
    expect(postValidation.resolvedValue).toBe('D:/Reports')
  })

  it('Case 3: explicit user input overrides validated preference', () => {
    const engine = new PreferenceEngine()
    engine.validateExplicitly('download_directory', 'D:/Reports', 'user_setting')

    const result = engine.resolve({
      key: 'download_directory',
      explicitInput: 'E:/QuarterlyReports', // Explicit current prompt instruction
      systemSafetyPermitted: true,
      currentRuntimeValid: true,
      safeDefault: 'C:/Users/Default/Downloads',
    })

    expect(result.resolvedSource).toBe('EXPLICIT_INPUT')
    expect(result.resolvedValue).toBe('E:/QuarterlyReports')
    expect(result.reason).toMatch(/explicit/i)
  })

  it('Case 4: invalid runtime state supersedes preference and falls back to safe default', () => {
    const engine = new PreferenceEngine()
    engine.validateExplicitly('download_directory', 'Z:/ExternalNetworkDrive', 'user_setting')

    // Drive Z: is disconnected (currentRuntimeValid = false)
    const result = engine.resolve({
      key: 'download_directory',
      systemSafetyPermitted: true,
      currentRuntimeValid: false,
      safeDefault: 'C:/Users/Default/Downloads',
    })

    expect(result.resolvedSource).toBe('RUNTIME_STATE')
    expect(result.resolvedValue).toBe('C:/Users/Default/Downloads')
    expect(result.reason).toContain('invalid for current runtime environment')
  })

  it('Case 5: safety policy supersedes preference', () => {
    const engine = new PreferenceEngine()
    engine.validateExplicitly('download_directory', 'C:/Windows/System32', 'malformed_pref')

    const result = engine.resolve({
      key: 'download_directory',
      systemSafetyPermitted: false, // Safety guard rejects system32
      currentRuntimeValid: true,
      safeDefault: 'C:/Users/Default/Downloads',
    })

    expect(result.resolvedSource).toBe('SAFETY_POLICY')
    expect(result.resolvedValue).toBe('C:/Users/Default/Downloads')
  })

  it('resets candidate confidence when user changes preference before validation', () => {
    const engine = new PreferenceEngine()

    engine.observe('preferred_browser', 'chrome', 'user_execution')
    const changed = engine.observe('preferred_browser', 'firefox', 'user_execution')

    expect(changed.status).toBe('CANDIDATE')
    expect(changed.confidence).toBe('LOW')
    expect(changed.observationCount).toBe(1)
    expect(changed.value).toBe('firefox')
  })

  it('persists validated preferences to disk and reloads on restart', () => {
    const tempFile = `C:/Users/Raaz/AppData/Local/Temp/usepilot-pref-test-${Date.now()}.json`
    const engine1 = new PreferenceEngine({ storagePath: tempFile })
    engine1.validateExplicitly('editor', 'code', 'user_setting')
    engine1.observe('theme', 'dark', 'user_execution')

    // Simulate process restart with a fresh engine instance pointing to the same file
    const engine2 = new PreferenceEngine({ storagePath: tempFile })
    const prefEditor = engine2.getPreference('editor')
    expect(prefEditor).toBeDefined()
    expect(prefEditor?.value).toBe('code')
    expect(prefEditor?.status).toBe('VALIDATED')

    const prefTheme = engine2.getPreference('theme')
    expect(prefTheme).toBeDefined()
    expect(prefTheme?.value).toBe('dark')
    expect(prefTheme?.status).toBe('CANDIDATE')

    // Clean up
    try {
      if (existsSync(tempFile)) {
        unlinkSync(tempFile)
      }
    } catch {
      // ignore
    }
  })
})
