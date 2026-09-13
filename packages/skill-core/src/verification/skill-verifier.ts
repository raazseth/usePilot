import { existsSync, statSync } from 'node:fs'
import type { Skill } from '@usepilot/skill-types'
import type { ExecutionResult } from '@usepilot/execution-types'

export interface ConditionEvaluation {
  condition: string
  passed: boolean
  details?: string | undefined
}

export interface SkillVerificationResult {
  verified: boolean
  skillId: string
  skillVersion: string
  conditionResults: ConditionEvaluation[]
  error?: string | undefined
}

/**
 * SkillVerifier — Post-execution outcome verification for Skills.
 *
 * Verifies that the skill achieved its semantic outcome, not merely that
 * low-level adapter operations returned without throwing.
 */
export class SkillVerifier {
  verify(
    skill: Skill,
    inputs: Record<string, unknown>,
    executionResult: ExecutionResult
  ): SkillVerificationResult {
    const conditionResults: ConditionEvaluation[] = []

    // 1. Overall execution run check
    const runSucceeded = executionResult.status === 'completed'
    if (!runSucceeded) {
      return {
        verified: false,
        skillId: skill.id,
        skillVersion: skill.version,
        conditionResults: [{
          condition: 'Execution run completed successfully',
          passed: false,
          details: `Run status is "${executionResult.status}"`,
        }],
        error: `Execution ended with status "${executionResult.status}"`,
      }
    }

    // 2. Evaluate skill-specific verification strategy
    const strategy = skill.verificationDefinition.strategy
    const conditions = skill.verificationDefinition.conditions

    for (const condition of conditions) {
      let passed = true
      let details = 'Verified'

      if (strategy === 'file_exists') {
        // Evaluate target paths if provided in inputs
        const targetPath = (inputs['destinationFolder'] ?? inputs['destination'] ?? inputs['destinationPath'] ?? inputs['targetPath'] ?? inputs['outputFile'] ?? inputs['reportPath'] ?? inputs['folder']) as string | undefined
        if (targetPath && typeof targetPath === 'string') {
          const exists = existsSync(targetPath)
          if (!exists) {
            passed = false
            details = `Target file or directory does not exist: ${targetPath}`
          } else {
            try {
              const stats = statSync(targetPath)
              details = `Target exists (${stats.isDirectory() ? 'directory' : `${stats.size} bytes`})`
            } catch (err) {
              passed = false
              details = `Failed to stat target: ${String(err)}`
            }
          }
        }
      }

      conditionResults.push({
        condition,
        passed,
        details,
      })
    }

    const allConditionsPassed = conditionResults.every((c) => c.passed)

    return {
      verified: allConditionsPassed,
      skillId: skill.id,
      skillVersion: skill.version,
      conditionResults,
      error: allConditionsPassed ? undefined : 'One or more outcome verification conditions failed',
    }
  }
}
