import type { SkillComposition } from '@usepilot/skill-types'

/**
 * SkillCompositionRegistry — Typed registry for named SkillComposition objects.
 *
 * Parallel to SkillRegistry in design.
 * Holds named compositions that can be looked up by ID at runtime.
 * Thread-safe for read-heavy workloads (all mutations are synchronous).
 */
export class SkillCompositionRegistry {
  private readonly compositions = new Map<string, SkillComposition>()

  /**
   * Registers a SkillComposition.
   * @throws if a composition with the same ID is already registered.
   */
  register(composition: SkillComposition): void {
    if (this.compositions.has(composition.id)) {
      throw new Error(
        `SkillCompositionRegistry: Composition "${composition.id}" is already registered. ` +
        `Use a unique composition ID.`
      )
    }
    this.compositions.set(composition.id, composition)
  }

  /**
   * Returns the composition with the given ID, or undefined if not found.
   */
  get(id: string): SkillComposition | undefined {
    return this.compositions.get(id)
  }

  /**
   * Returns true if a composition with the given ID is registered.
   */
  has(id: string): boolean {
    return this.compositions.has(id)
  }

  /**
   * Returns all registered compositions.
   */
  list(): SkillComposition[] {
    return Array.from(this.compositions.values())
  }

  /**
   * Returns the total number of registered compositions.
   */
  get size(): number {
    return this.compositions.size
  }
}
