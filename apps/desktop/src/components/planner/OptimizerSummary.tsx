import './planner.css'
import type { OptimizationResult } from '@usepilot/planner-types'

interface OptimizerSummaryProps {
  optimization: OptimizationResult
}

export function OptimizerSummary({ optimization }: OptimizerSummaryProps) {
  if (!optimization.changed && (!optimization.simplifications || optimization.simplifications.length === 0)) {
    return null
  }

  return (
    <div className="optimizer-summary">
      <div className="optimizer-summary-title">⚡ Plan Optimizations Applied</div>
      {optimization.simplifications.map((item, idx) => (
        <div key={idx} className="optimizer-simplification">
          <span>•</span>
          <span>{item}</span>
        </div>
      ))}
      {optimization.removedDuplicates.length > 0 && (
        <div className="optimizer-simplification">
          <span>•</span>
          <span>Removed {optimization.removedDuplicates.length} redundant task(s)</span>
        </div>
      )}
      {optimization.mergedTasks.length > 0 && (
        <div className="optimizer-simplification">
          <span>•</span>
          <span>Merged {optimization.mergedTasks.length} sequential task pair(s)</span>
        </div>
      )}
      {optimization.newParallelGroups.length > 0 && (
        <div className="optimizer-simplification">
          <span>•</span>
          <span>Discovered {optimization.newParallelGroups.length} concurrent execution group(s)</span>
        </div>
      )}
    </div>
  )
}
