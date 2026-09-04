import './planner.css'
import type { PlanningStage } from '@usepilot/planner-types'

interface PlanningProgressProps {
  stage: PlanningStage
  message: string
  progressPct: number
}

const STAGE_CONFIG: Record<PlanningStage, { label: string; sub: string }> = {
  classifying: { label: 'Classifying Request', sub: 'Determining intent and routing...' },
  normalizing: { label: 'Normalizing Input', sub: 'Cleaning text and detecting entities...' },
  extracting: { label: 'Extracting Goal', sub: 'Structuring objective and constraints...' },
  validating_goal: { label: 'Validating Goal', sub: 'Verifying completeness...' },
  analyzing: { label: 'Analyzing Intent', sub: 'Assessing tools and operational risk...' },
  generating: { label: 'Generating Tasks', sub: 'Formulating atomic executable steps...' },
  building: { label: 'Building Graph', sub: 'Constructing dependency DAG...' },
  validating: { label: 'Validating Plan', sub: 'Running 3-layer validation suite...' },
  optimizing: { label: 'Optimizing Plan', sub: 'Merging steps and identifying parallel groups...' },
  serializing: { label: 'Hashing Blueprint', sub: 'Generating deterministic SHA-256 fingerprint...' },
  persisting: { label: 'Saving Blueprint', sub: 'Storing plan in database...' },
  ready: { label: 'Plan Ready', sub: 'Execution blueprint generated successfully.' },
}

const ORDERED_STAGES: PlanningStage[] = [
  'classifying',
  'normalizing',
  'extracting',
  'analyzing',
  'generating',
  'building',
  'validating',
  'optimizing',
  'serializing',
  'ready',
]

export function PlanningProgress({ stage, message, progressPct }: PlanningProgressProps) {
  const currentInfo = STAGE_CONFIG[stage] ?? { label: 'Planning...', sub: message }
  const currentIndex = ORDERED_STAGES.indexOf(stage)

  return (
    <div className="planning-progress">
      <div className="planning-progress-header">
        <div className="planning-progress-icon">
          <span style={{ fontSize: '14px' }}>🧠</span>
        </div>
        <div style={{ flex: 1 }}>
          <div className="planning-progress-label">{currentInfo.label}</div>
          <div className="planning-progress-sub">{message || currentInfo.sub}</div>
        </div>
        <div className="planning-stages">
          {ORDERED_STAGES.map((s, idx) => {
            const isDone = currentIndex > idx || stage === 'ready'
            const isActive = currentIndex === idx && stage !== 'ready'
            return (
              <div
                key={s}
                className={`planning-stage-dot ${isDone ? 'done' : ''} ${isActive ? 'active' : ''}`}
                title={STAGE_CONFIG[s].label}
              />
            )
          })}
        </div>
      </div>

      <div className="planning-progress-bar-wrap">
        <div
          className="planning-progress-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
    </div>
  )
}
