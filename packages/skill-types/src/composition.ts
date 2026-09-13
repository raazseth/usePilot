/**
 * Skill Composition Specification
 *
 * Enables composing multiple Skills into a composite workflow:
 * e.g., Skill A (Research Website) -> output -> Skill B (Save Report).
 */
export interface SkillCompositionStep {
  stepId: string
  skillId: string
  skillVersion?: string | undefined
  /**
   * Maps inputs of this step to either static values, or references to prior step outputs:
   * e.g., { filePath: '$steps.step1.downloadPath' }
   */
  inputBindings: Record<string, string | unknown>
  isOptional?: boolean | undefined
}

export interface SkillComposition {
  id: string
  name: string
  description: string
  version: string
  steps: SkillCompositionStep[]
  tags?: string[] | undefined
}
