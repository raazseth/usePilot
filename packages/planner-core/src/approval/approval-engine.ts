// ─────────────────────────────────────────────────────────────────────────────
// ApprovalEngine
// Scans the task list and assigns ApprovalPolicy based on operation category
// and content signals. Runs after TaskGenerator, before GraphBuilder.
// The planner decides policies — Phase 3 reads them, never infers them.
// ─────────────────────────────────────────────────────────────────────────────

import type { Task, ApprovalPolicy } from '@usepilot/planner-types'

interface PolicyRule {
  signals: string[]
  policy: ApprovalPolicy
  reason: string
}

// Rules are evaluated in order. First match wins.
const POLICY_RULES: PolicyRule[] = [
  // Forbidden — never execute
  {
    signals: ['system32', 'delete system', 'format drive', 'rm -rf /', 'wipe disk', 'factory reset'],
    policy: 'forbidden',
    reason: 'Potentially catastrophic system operation — execution is not permitted',
  },

  // Mandatory — must have explicit human approval
  {
    signals: ['transfer', 'payment', 'purchase', 'buy', 'pay', 'bank', 'credit card', 'debit'],
    policy: 'mandatory',
    reason: 'Financial transaction requires explicit approval',
  },
  {
    signals: ['delete', 'remove', 'uninstall', 'erase', 'wipe', 'drop table', 'truncate'],
    policy: 'mandatory',
    reason: 'Destructive operation — data cannot be recovered without confirmation',
  },
  {
    signals: ['send email', 'send message', 'post on', 'tweet', 'publish', 'submit form'],
    policy: 'mandatory',
    reason: 'External communication — requires human review before sending',
  },
  {
    signals: ['login', 'log in', 'authenticate', 'sign in', 'enter password', 'credentials'],
    policy: 'mandatory',
    reason: 'Authentication action requires explicit user approval for security',
  },
  {
    signals: ['execute command', 'run script', 'terminal', 'shell', 'powershell', 'bash', 'cmd'],
    policy: 'mandatory',
    reason: 'Terminal command execution requires explicit approval',
  },

  // Optional — user may choose to review
  {
    signals: ['move', 'rename', 'overwrite', 'replace', 'update', 'modify settings'],
    policy: 'optional',
    reason: 'Modifying action — user may want to review before execution',
  },
  {
    signals: ['upload', 'share', 'export', 'sync'],
    policy: 'optional',
    reason: 'Data sharing action — user may want to review before execution',
  },
]

export class ApprovalEngine {
  /**
   * Evaluates a single task and returns its policy and reason.
   */
  evaluate(task: Task): { policy: ApprovalPolicy; reason: string } {
    return this.classifyTask(task)
  }

  /**
   * Assigns ApprovalPolicy to each task in-place.
   * Returns the modified tasks (same array, mutated).
   */
  assignPolicies(tasks: Task[]): Task[] {
    return tasks.map((task) => {
      const { policy, reason } = this.classifyTask(task)
      return {
        ...task,
        approvalPolicy: policy,
        approvalReason: reason,
      }
    })
  }

  private classifyTask(task: Task): { policy: ApprovalPolicy; reason: string } {
    const haystack = `${task.title} ${task.description} ${task.category}`.toLowerCase()

    for (const rule of POLICY_RULES) {
      for (const signal of rule.signals) {
        if (haystack.includes(signal)) {
          return { policy: rule.policy, reason: rule.reason }
        }
      }
    }

    // Tool-based fallback rules
    if (task.requiredTool === 'terminal') {
      return { policy: 'mandatory', reason: 'Terminal tool usage always requires approval' }
    }
    if (task.requiredTool === 'email') {
      return { policy: 'optional', reason: 'Email actions should be user-reviewed' }
    }

    return { policy: 'automatic', reason: 'Low-risk operation — can execute without interruption' }
  }
}
