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
  const [showExplanation, setShowExplanation] = useState(false)

  const {
    goal,
    intent,
    tasks,
    approvals,
    successCriteria,
    estimatedComplexity,
    optimization,
    explanation,
    plannerConfidence,
    status,
  } = blueprint

  const confidencePct = plannerConfidence !== undefined ? Math.round(plannerConfidence * 100) : null
  const confidenceColor =
    confidencePct !== null
      ? confidencePct >= 80
        ? '#22c55e'
        : confidencePct >= 60
          ? '#eab308'
          : '#ef4444'
      : undefined

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
            {status === 'needs_info' && (
              <span className="plan-badge" style={{ background: 'rgba(234, 179, 8, 0.2)', color: '#eab308', border: '1px solid #eab308' }}>
                Needs Clarification
              </span>
            )}
            {confidencePct !== null && (
              <span
                className="plan-badge"
                style={{
                  background: `rgba(${confidencePct >= 80 ? '34, 197, 94' : confidencePct >= 60 ? '234, 179, 8' : '239, 68, 68'}, 0.15)`,
                  color: confidenceColor,
                }}
              >
                {confidencePct}% Confidence
              </span>
            )}
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
          {/* Missing Information Banner */}
          {goal.missingInformation && goal.missingInformation.length > 0 && (
            <div className="plan-missing-info-card">
              <div className="plan-missing-info-header">
                <span>❓</span>
                <strong>Essential Information Required ({goal.missingInformation.length} item{goal.missingInformation.length === 1 ? '' : 's'})</strong>
              </div>
              <p className="plan-missing-info-desc">
                To guarantee safe and deterministic execution, please provide answers to the following parameter(s):
              </p>
              <div className="plan-missing-info-list">
                {goal.missingInformation.map((item) => (
                  <div key={item.id} className="plan-missing-info-item">
                    <div className="plan-missing-info-question">
                      <span className={`plan-missing-importance-${item.importance}`}>
                        {item.importance}
                      </span>
                      <span>{item.question}</span>
                    </div>
                    <div className="plan-missing-info-reason">{item.reason}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

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

          {/* Plan Explanation Accordion */}
          {explanation && (
            <div className="plan-explanation-box">
              <div
                className="plan-explanation-toggle"
                onClick={() => setShowExplanation(!showExplanation)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setShowExplanation(!showExplanation)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>💡</span>
                  <span className="plan-explanation-title">Why this plan? (Architecture & Rationale)</span>
                </div>
                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                  {showExplanation ? 'Hide' : 'Show rationale'}
                </span>
              </div>

              {showExplanation && (
                <div className="plan-explanation-content">
                  <div className="plan-explanation-summary">{explanation.summary}</div>

                  {explanation.reasoning.length > 0 && (
                    <div className="plan-explanation-group">
                      <div className="plan-explanation-subhead">Reasoning & Strategy</div>
                      {explanation.reasoning.map((r, i) => (
                        <div key={i} className="plan-explanation-bullet">
                          <span>•</span>
                          <span>{r}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {explanation.assumptions.length > 0 && (
                    <div className="plan-explanation-group">
                      <div className="plan-explanation-subhead">Assumptions</div>
                      {explanation.assumptions.map((a, i) => (
                        <div key={i} className="plan-explanation-bullet">
                          <span>•</span>
                          <span>{a}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {explanation.tradeoffs.length > 0 && (
                    <div className="plan-explanation-group">
                      <div className="plan-explanation-subhead">Tradeoffs Evaluated</div>
                      {explanation.tradeoffs.map((t, i) => (
                        <div key={i} className="plan-explanation-bullet">
                          <span>•</span>
                          <span>{t}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="plan-explanation-group">
                    <div className="plan-explanation-subhead">Risk Governance</div>
                    <div className="plan-explanation-risk">{explanation.riskAssessment}</div>
                  </div>
                </div>
              )}
            </div>
          )}

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
