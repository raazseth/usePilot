import type { ExecutionReport as ExecutionReportType } from '@usepilot/execution-types'

interface ExecutionReportProps {
  report: ExecutionReportType
}

function fmtDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${(ms / 60000).toFixed(1)}min`
}

export function ExecutionReport({ report }: ExecutionReportProps) {
  const { summary, taskSummaries, metrics, failureCategories } = report
  const completed = taskSummaries.filter(t => t.status === 'completed').length
  const failed = taskSummaries.filter(t => t.status === 'failed').length
  const skipped = taskSummaries.filter(t => t.status === 'skipped').length

  return (
    <div className="execution-report" id="execution-report">
      <div className="execution-report-title">Execution Report</div>
      <div className="execution-report-summary">{summary}</div>

      <div className="execution-report-metrics">
        <div className="exec-metric-card">
          <div className="exec-metric-value" style={{ color: '#4ade80' }}>{completed}</div>
          <div className="exec-metric-label">Completed</div>
        </div>
        <div className="exec-metric-card">
          <div className="exec-metric-value" style={{ color: failed > 0 ? '#f87171' : '#94a3b8' }}>{failed}</div>
          <div className="exec-metric-label">Failed</div>
        </div>
        <div className="exec-metric-card">
          <div className="exec-metric-value" style={{ color: '#94a3b8' }}>{skipped}</div>
          <div className="exec-metric-label">Skipped</div>
        </div>
        <div className="exec-metric-card">
          <div className="exec-metric-value">{fmtDuration(metrics.totalDurationMs)}</div>
          <div className="exec-metric-label">Total Time</div>
        </div>
        <div className="exec-metric-card">
          <div className="exec-metric-value">{metrics.retryCount}</div>
          <div className="exec-metric-label">Retries</div>
        </div>
        <div className="exec-metric-card">
          <div className="exec-metric-value">{metrics.checkpointCount}</div>
          <div className="exec-metric-label">Checkpoints</div>
        </div>
      </div>

      {failureCategories.length > 0 && (
        <div style={{ marginBottom: '12px', fontSize: '12px', color: '#f87171' }}>
          <strong>Failures:</strong> {failureCategories.join(', ')}
        </div>
      )}

      {metrics.approvalWaitTimeMs > 0 && (
        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '8px' }}>
          <strong>Approval wait:</strong> {fmtDuration(metrics.approvalWaitTimeMs)}
        </div>
      )}
    </div>
  )
}
