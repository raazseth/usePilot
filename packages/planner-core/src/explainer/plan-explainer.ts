// PlanExplainer

import type {
  Goal,
  Intent,
  Task,
  TaskGraph,
  ApprovalSummary,
  PlanExplanation,
  PlannerContext,
} from '@usepilot/planner-types'

export class PlanExplainer {
  explain(
    goal: Goal,
    intent: Intent,
    tasks: Task[],
    graph: TaskGraph,
    approvals: ApprovalSummary,
    context: PlannerContext
  ): PlanExplanation {
    const reasoning: string[] = []
    const assumptions: string[] = []
    const tradeoffs: string[] = []

    // 1. Synthesize Strategy Summary
    const taskCount = tasks.length
    const parallelCount = graph.parallelGroups.length
    const summary = `Formulated a ${intent.complexity}-complexity workflow comprising ${taskCount} atomic step(s) to achieve "${goal.primaryObjective}".`

    // 2. Identify Reasoning based on capabilities & intent
    const capabilities = Array.from(new Set(tasks.map((t) => t.requiredCapability)))
    if (capabilities.includes('navigate_website') || capabilities.includes('extract_web_data')) {
      reasoning.push(
        'Web interaction is used because target resources require authenticated portal navigation.'
      )
    }
    if (capabilities.includes('download_file') || capabilities.includes('write_file') || capabilities.includes('move_file')) {
      reasoning.push(
        'Local filesystem operations are scheduled to persist and structure extracted artifacts directly on the user machine.'
      )
    }
    if (parallelCount > 0) {
      reasoning.push(
        `Identified ${parallelCount} independent group(s) that can run concurrently without mutual state interference.`
      )
    } else {
      reasoning.push(
        'Sequenced all operations strictly linearly to ensure strict state precondition fulfillment at each step.'
      )
    }

    // 3. Document Assumptions
    assumptions.push(`Workflow assumes host operating system is ${context.platform}.`)
    if (capabilities.includes('navigate_website') || capabilities.includes('authenticate_user')) {
      assumptions.push('Assumes user has active access or credentials for relevant web services.')
    }
    if (goal.constraints.length > 0) {
      const constraintKeys = goal.constraints.map((c) => `${c.key} (${c.value})`).join(', ')
      assumptions.push(`Plan respects user-defined constraints: ${constraintKeys}.`)
    }

    // 4. Document Tradeoffs
    if (parallelCount === 0 && taskCount > 2) {
      tradeoffs.push(
        'Prioritized deterministic execution safety and state verification over aggressive concurrency.'
      )
    } else if (parallelCount > 0) {
      tradeoffs.push(
        'Optimized for completion speed by batching independent tasks into concurrent execution waves.'
      )
    }
    if (approvals.requiresMandatoryApproval) {
      tradeoffs.push(
        'Interrupted automated flow with mandatory approval checkpoints to safeguard user data and sensitive actions.'
      )
    }

    // 5. Risk Assessment
    let riskAssessment = `Overall operational risk is assessed as ${intent.riskLevel.toUpperCase()}. `
    if (approvals.hasForbiddenTasks) {
      riskAssessment += 'CRITICAL: Contains forbidden system actions that invalidate execution.'
    } else if (approvals.requiresMandatoryApproval) {
      riskAssessment += `${approvals.mandatoryTaskIds.length} task(s) require explicit user approval before execution.`
    } else {
      riskAssessment += 'All tasks qualify for automatic execution without manual intervention.'
    }

    return {
      summary,
      reasoning,
      assumptions,
      tradeoffs,
      riskAssessment,
    }
  }
}
