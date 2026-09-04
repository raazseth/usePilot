import './planner.css'
import { useState } from 'react'
import type { ValidationResult } from '@usepilot/planner-types'

interface ValidationReportProps {
  validation: ValidationResult
}

const LAYER_LABELS: Record<string, string> = {
  schema: 'Schema',
  semantic: 'Semantic',
  execution: 'Execution',
}

export function ValidationReport({ validation }: ValidationReportProps) {
  const [expanded, setExpanded] = useState<string | null>(null)
  const layers = [validation.schema, validation.semantic, validation.execution]

  return (
    <div className="validation-report">
      {layers.map((layer) => {
        const isExpanded = expanded === layer.layer
        const dot =
          layer.passed ? 'validation-dot-pass'
          : layer.issues.length === 0 ? 'validation-dot-skip'
          : 'validation-dot-fail'
        const hasIssues = layer.issues.length > 0

        return (
          <div className="validation-layer" key={layer.layer}>
            <div
              className="validation-layer-header"
              onClick={() => setExpanded(isExpanded ? null : layer.layer)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && setExpanded(isExpanded ? null : layer.layer)}
            >
              <div className={`validation-layer-dot ${dot}`} />
              <span className="validation-layer-name">{LAYER_LABELS[layer.layer] ?? layer.layer}</span>
              {hasIssues && (
                <span style={{ fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
                  {layer.issues.filter(i => i.severity === 'error').length > 0
                    ? `${layer.issues.filter(i => i.severity === 'error').length} error(s)`
                    : `${layer.issues.length} warning(s)`
                  }
                </span>
              )}
              {!hasIssues && layer.passed && (
                <span style={{ fontSize: '11px', color: '#22c55e' }}>Passed</span>
              )}
              {!hasIssues && !layer.passed && (
                <span style={{ fontSize: '11px', color: '#475569' }}>Skipped</span>
              )}
            </div>
            {isExpanded && hasIssues && (
              <div className="validation-layer-body">
                {layer.issues.map((issue, idx) => (
                  <div
                    key={idx}
                    className={`validation-issue validation-issue-${issue.severity}`}
                  >
                    <span>{issue.severity === 'error' ? '✕' : issue.severity === 'warning' ? '⚠' : '›'}</span>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
