import { generateId } from '@usepilot/utils'
import type { SkillComposition, Workflow } from '@usepilot/skill-types'
import type { ExecutionBlueprint, Task } from '@usepilot/planner-types'
import { GraphBuilder, PlanSerializer } from '@usepilot/planner-core'
import type { SkillRegistry } from '../registry/skill-registry'
import { SkillResolver } from '../resolver/skill-resolver'

export interface ComposedWorkflowResult {
  workflow: Workflow
  blueprint: ExecutionBlueprint
}

/**
 * SkillComposer — Chains multiple Skills into a unified, deterministic workflow.
 *
 * Enforces:
 * - Explicit input/output bindings between steps
 * - No hidden global state
 * - Strict cross-skill dependency graph wiring
 */
export class SkillComposer {
  private readonly resolver = new SkillResolver()
  private readonly graphBuilder = new GraphBuilder()
  private readonly serializer = new PlanSerializer()

  constructor(private readonly registry: SkillRegistry) {}

  async compose(
    composition: SkillComposition,
    initialInputs: Record<string, unknown> = {}
  ): Promise<ComposedWorkflowResult> {
    const allTasks: Task[] = []
    let previousStepTerminalTaskId: string | null = null
    const accumulatedOutputs: Record<string, unknown> = { ...initialInputs }

    for (let i = 0; i < composition.steps.length; i++) {
      const step = composition.steps[i]!
      const skill = this.registry.get(step.skillId)
      if (!skill) {
        throw new Error(`Composition "${composition.id}": Skill "${step.skillId}" not found in registry.`)
      }

      // Resolve step inputs from bindings
      const stepRawInputs: Record<string, unknown> = {}
      for (const [inputKey, binding] of Object.entries(step.inputBindings)) {
        if (typeof binding === 'string' && binding.startsWith('$')) {
          const path = binding.slice(1) // e.g. "step1.reportContent" or "initial.url"
          stepRawInputs[inputKey] = accumulatedOutputs[path] ?? initialInputs[path]
        } else if (
          binding &&
          typeof binding === 'object' &&
          'source' in binding &&
          'key' in binding
        ) {
          const b = binding as { source: string; key: string }
          if (b.source === 'workflow_input') {
            stepRawInputs[inputKey] = initialInputs[b.key]
          } else {
            stepRawInputs[inputKey] = accumulatedOutputs[b.key] ?? initialInputs[b.key]
          }
        } else {
          stepRawInputs[inputKey] = binding
        }
      }

      const resolution = this.resolver.resolve(skill, stepRawInputs)
      if (!resolution.success) {
        throw new Error(
          `Composition "${composition.id}" failed at step "${step.stepId}": ${resolution.userPromptRequired ?? 'Invalid inputs'}`
        )
      }

      // Generate tasks for this step
      const templates = skill.workflowDefinition.generateTasks(resolution.configuredInputs)
      const stepIdPrefix = `step${i + 1}-${step.stepId}`
      const idMap = new Map<string, string>()

      for (const t of templates) {
        idMap.set(t.id, `${stepIdPrefix}-${t.id}`)
      }

      const stepTasks: Task[] = templates.map((tmpl, taskIdx) => {
        const concreteId = idMap.get(tmpl.id) ?? tmpl.id
        const remappedDepends = tmpl.dependsOn.map((d) => idMap.get(d) ?? d)

        // If this is the first task of a subsequent step, wire it to the terminal task of the previous step
        if (taskIdx === 0 && previousStepTerminalTaskId) {
          remappedDepends.push(previousStepTerminalTaskId)
        }

        return {
          id: concreteId,
          title: `[${skill.name}] ${tmpl.title}`,
          description: tmpl.description,
          category: tmpl.category ?? 'computation',
          requiredCapability: tmpl.requiredCapability,
          toolConfig: tmpl.toolConfigFactory(resolution.configuredInputs),
          expectedOutput: tmpl.description,
          preconditions: tmpl.preconditions,
          postconditions: tmpl.postconditions,
          successConditions: tmpl.successConditions,
          failureConditions: tmpl.failureConditions ?? [],
          dependsOn: remappedDepends,
          approvalPolicy: tmpl.approvalPolicy ?? (skill.riskLevel === 'high' ? 'mandatory' : 'automatic'),
          approvalReason: tmpl.approvalReason,
          complexity: tmpl.complexity ?? 'medium',
          retryPolicy: { maxAttempts: 2, backoffMs: 300, exponential: true },
          failureStrategy: { onFailure: 'abort' },
          confidence: 0.95,
        }
      })

      allTasks.push(...stepTasks)
      previousStepTerminalTaskId = stepTasks[stepTasks.length - 1]?.id ?? null
    }

    // Build unified DAG
    const graph = this.graphBuilder.build(allTasks)

    const rawBlueprint: ExecutionBlueprint = {
      id: generateId(),
      version: 1,
      hash: '',
      status: 'ready',
      goal: {
        id: generateId(),
        primaryObjective: composition.name,
        constraints: [],
        requiredResources: [],
        expectedOutcome: composition.description,
        confidence: 1.0,
        status: 'validated',
        normalizedInput: {
          text: composition.name,
          originalText: composition.name,
          detectedLanguage: 'en',
          entities: [],
          durationMs: 0,
        },
        createdAt: Date.now(),
      },
      intent: {
        type: 'mixed',
        riskLevel: 'medium',
        complexity: 'high',
        requiresHumanApproval: allTasks.some((t) => t.approvalPolicy === 'mandatory'),
        missingInformation: [],
        confidence: 1.0,
        durationMs: 0,
      },
      tasks: allTasks,
      graph,
      approvals: {
        requiresMandatoryApproval: allTasks.some((t) => t.approvalPolicy === 'mandatory'),
        hasForbiddenTasks: allTasks.some((t) => t.approvalPolicy === 'forbidden'),
        mandatoryTaskIds: allTasks.filter((t) => t.approvalPolicy === 'mandatory').map((t) => t.id),
        optionalTaskIds: allTasks.filter((t) => t.approvalPolicy === 'optional').map((t) => t.id),
        forbiddenTaskIds: allTasks.filter((t) => t.approvalPolicy === 'forbidden').map((t) => t.id),
      },
      successCriteria: allTasks.flatMap((t) =>
        t.successConditions.map((c) => ({
          condition: c,
          verificationStrategy: 'state_check' as const,
          required: true,
        }))
      ),
      estimatedComplexity: 'high',
      optimization: {
        mergedTasks: [],
        removedDuplicates: [],
        newParallelGroups: [],
        simplifications: [],
        changed: false,
      },
      explanation: {
        summary: `Composed workflow "${composition.name}" combining ${composition.steps.length} skills.`,
        reasoning: [`Generated ${allTasks.length} sequential tasks across skill stages.`],
        assumptions: [],
        tradeoffs: [],
        riskAssessment: 'Multi-step composed execution.',
      },
      plannerConfidence: 1.0,
      plannerContext: {
        platform: 'windows',
        availableTools: [],
        settingsSnapshot: {},
        previousBlueprintCount: 0,
      },
      createdAt: Date.now(),
    }

    const blueprint = await this.serializer.serialize(rawBlueprint, 1)

    const workflow: Workflow = {
      id: generateId(),
      skillId: composition.id,
      skillVersion: composition.version,
      name: composition.name,
      description: composition.description,
      inputs: initialInputs,
      tasks: allTasks,
      expectedOutputs: {},
      verificationCriteria: rawBlueprint.successCriteria,
      policyHints: {
        riskLevel: 'medium',
      },
      metadata: {
        createdAt: Date.now(),
        tags: composition.tags ?? ['composition'],
      },
    }

    return {
      workflow,
      blueprint,
    }
  }
}
