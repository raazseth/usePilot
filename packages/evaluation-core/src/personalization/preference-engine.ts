import type {
  UserPreference,
  PreferenceResolutionContext,
  PreferenceResolutionResult,
} from '@usepilot/evaluation-types'
import type { ExecutionMemoryStore } from '@usepilot/runtime-context'

/**
 * PreferenceEngine — Manages user preferences through repeated observation and validation.
 *
 * Enforces Architectural Invariants:
 * 1. Single observation != permanent preference.
 * 2. Progression: Observed (1) -> Candidate (2) -> Validated (>=3 or user confirmation).
 * 3. Precedence hierarchy:
 *    Explicit Current User Input > System Safety > Current Runtime State > Validated Preference > Historical Execution > Safe Default
 * 4. Integrates with existing ExecutionMemoryStore without duplicating memory.
 */
export class PreferenceEngine {
  private readonly preferences = new Map<string, UserPreference>()

  constructor(private readonly memoryStore?: ExecutionMemoryStore | undefined) {}

  /**
   * Observe a user choice or parameter value.
   */
  observe(key: string, value: unknown, source: string): UserPreference {
    const existing = this.preferences.get(key)

    if (!existing) {
      const initial: UserPreference = {
        id: `pref-${key}`,
        key,
        value,
        observationCount: 1,
        confidence: 'LOW',
        status: 'CANDIDATE',
        source,
        lastObservedAt: Date.now(),
        lastValidatedAt: Date.now(),
      }
      this.preferences.set(key, initial)
      return initial
    }

    // If observed with the same value, increment count and promote if threshold reached
    if (JSON.stringify(existing.value) === JSON.stringify(value)) {
      existing.observationCount++
      existing.lastObservedAt = Date.now()

      if (existing.observationCount >= 3) {
        existing.status = 'VALIDATED'
        existing.confidence = 'HIGH'
        existing.lastValidatedAt = Date.now()
      } else if (existing.observationCount === 2) {
        existing.status = 'CANDIDATE'
        existing.confidence = 'MEDIUM'
      }

      this.preferences.set(key, existing)
      return existing
    }

    // Value changed: reset candidate confidence to prevent stale lock-in
    existing.value = value
    existing.observationCount = 1
    existing.status = 'CANDIDATE'
    existing.confidence = 'LOW'
    existing.lastObservedAt = Date.now()
    this.preferences.set(key, existing)
    return existing
  }

  /**
   * Explicitly validate a preference (e.g. user confirmed via UI or prompt).
   */
  validateExplicitly(key: string, value: unknown, source: string): UserPreference {
    const pref: UserPreference = {
      id: `pref-${key}`,
      key,
      value,
      observationCount: 3,
      confidence: 'HIGH',
      status: 'VALIDATED',
      source,
      lastObservedAt: Date.now(),
      lastValidatedAt: Date.now(),
    }
    this.preferences.set(key, pref)
    return pref
  }

  getPreference(key: string): UserPreference | undefined {
    return this.preferences.get(key)
  }

  listValidatedPreferences(): UserPreference[] {
    return Array.from(this.preferences.values()).filter((p) => p.status === 'VALIDATED')
  }

  /**
   * Resolves a value following the strict precedence hierarchy:
   * 1. Explicit Current User Input
   * 2. System Safety
   * 3. Current Runtime State
   * 4. Validated Preference
   * 5. Historical Execution (from MemoryStore)
   * 6. Safe Default
   */
  resolve(context: PreferenceResolutionContext): PreferenceResolutionResult {
    // 1. Explicit Current User Input
    if (context.explicitInput !== undefined && context.explicitInput !== null) {
      return {
        key: context.key,
        resolvedValue: context.explicitInput,
        resolvedSource: 'EXPLICIT_INPUT',
        reason: 'User provided an explicit value in the current instruction.',
      }
    }

    // 2. System Safety Policy
    if (!context.systemSafetyPermitted) {
      return {
        key: context.key,
        resolvedValue: context.safeDefault,
        resolvedSource: 'SAFETY_POLICY',
        reason: 'Preference or input violates safety policy; falling back to safe default.',
      }
    }

    // 3. Current Runtime State
    if (!context.currentRuntimeValid) {
      return {
        key: context.key,
        resolvedValue: context.safeDefault,
        resolvedSource: 'RUNTIME_STATE',
        reason: 'Stored preference is invalid for current runtime environment (e.g. drive unmounted).',
      }
    }

    // 4. Validated Preference
    const storedPref = this.preferences.get(context.key)
    if (storedPref && storedPref.status === 'VALIDATED') {
      return {
        key: context.key,
        resolvedValue: storedPref.value,
        resolvedSource: 'VALIDATED_PREFERENCE',
        reason: `Using validated user preference observed ${storedPref.observationCount} times.`,
      }
    }

    // 5. Historical Execution Pattern (from MemoryStore)
    if (this.memoryStore && context.historicalPattern !== undefined) {
      return {
        key: context.key,
        resolvedValue: context.historicalPattern,
        resolvedSource: 'HISTORICAL_PATTERN',
        reason: 'Resolved from past successful execution pattern in ExecutionMemoryStore.',
      }
    }

    // 6. Safe Default
    return {
      key: context.key,
      resolvedValue: context.safeDefault,
      resolvedSource: 'SAFE_DEFAULT',
      reason: 'No explicit input, validated preference, or memory pattern found; using safe default.',
    }
  }

  clear(): void {
    this.preferences.clear()
  }
}
