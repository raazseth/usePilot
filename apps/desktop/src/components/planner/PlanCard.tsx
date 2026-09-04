import './planner.css'
import { useState } from 'react'
import type { ExecutionBlueprint, ValidationResult } from '@usepilot/planner-types'
import { TaskCard } from './TaskCard'
import { ValidationReport } from './ValidationReport'
import { OptimizerSummary } from './OptimizerSummary'

interface PlanCardProps {
  blueprint: ExecutionBlueprint
  validation?: ValidationResult
}

export function PlanCard({ blueprint, validation }: PlanCardProps) {
  const [expanded, setExpanded] = useState(true)

  const { goal, intent, tasks, approvals, successCriteria, estimatedComplexity, optimization } = blueprint

  return (
    <div className="plan-card">
      <div
        className="plan-card-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && setExpanded(!expanded)}
      >
        <div className="plan-card-header-icon">📋</div>
        <div className="plan-card-header-meta">
          <div className="plan-card-objective">{goal.primaryObjective}</div>
          <div className="plan-card-badges">
            <span className={`plan-badge plan-badge-complexity-${estimatedComplexity}`}>
              {estimatedComplexity} complexity
            </span>
            <span className="plan-badge plan-badge-intent">
              {intent.type}
            </span>
            <span className={`plan-badge plan-badge-risk-${intent.riskLevel}`}>
              {intent.riskLevel} risk
            </span>
            <span className="plan-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-secondary)' }}>
              {tasks.length} task{tasks.length === 1 ? '' : 's'}
            </span>
            <span className="plan-badge" style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--color-text-tertiary)' }}>
              v{blueprint.version}
            </span>
          </div>
        </div>
        <div className={`plan-card-chevron ${expanded ? 'expanded' : ''}`}>▼</div>
      </div>

      {expanded && (
        <div className="plan-card-body">
          {/* Approval Warning Banner */}
          {approvals.hasForbiddenTasks ? (
            <div className="plan-approval-banner" style={{ background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.3)', color: '#ef4444' }}>
              <span>🛑</span>
              <div>
                <strong>Forbidden Tasks Detected:</strong> This plan contains actions flagged as forbidden and cannot be approved for execution.
              </div>
            </div>
          ) : approvals.requiresMandatoryApproval ? (
            <div className="plan-approval-banner">
              <span>⚠️</span>
              <div>
                <strong>Review Required:</strong> {approvals.mandatoryTaskIds.length} task(s) require explicit user approval before execution.
              </div>
            </div>
          ) : null}

          {/* Success Criteria */}
          {successCriteria && successCriteria.length > 0 && (
            <div className="plan-criteria">
              <div className="plan-criteria-title">Success Criteria</div>
              {successCriteria.map((item, idx) => (
                <div key={idx} className="plan-criteria-item">
                  <div className="plan-criteria-dot" />
                  <span>{item.condition}</span>
                </div>
              ))}
            </div>
          )}

          {/* Task List */}
          <div className="task-list">
            <div className="task-list-header">
              <span className="task-list-title">Execution Steps</span>
              <span className="task-list-count">
                {tasks.length} atomic step{tasks.length === 1 ? '' : 's'}
                {blueprint.graph.parallelGroups.length > 0 && ` • ${blueprint.graph.parallelGroups.length} parallel group(s)`}
              </span>
            </div>
            {tasks.map((task, idx) => (
              <TaskCard key={task.id} task={task} index={idx} />
            ))}
          </div>

          {/* Optimizations */}
          {optimization && <OptimizerSummary optimization={optimization} />}

          {/* Validation Report (if available) */}
          {validation && (
            <div>
              <div className="plan-criteria-title" style={{ marginBottom: '8px' }}>Validation Suite</div>
              <ValidationReport validation={validation} />
            </div>
          )}

          {/* Action button */}
          <div>
            <button
              className="plan-execute-btn"
              disabled
              title="Execution Engine will be enabled in Phase 3"
            >
              <span>▶</span>
              <span>Execute Blueprint</span>
            </button>
            <div className="plan-execute-hint" style={{ marginTop: '6px' }}>
              Phase 2 deterministic intelligence layer — execution engine unlocks in Phase 3
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
