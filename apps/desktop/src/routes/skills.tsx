import { useState, useEffect } from 'react'
import { wsManager } from '../shared/api/websocket'
import './skills.css'

export interface UISkillField {
  name: string
  type: string
  description: string
  required?: boolean
  default?: unknown
  promptQuestion?: string
}

export interface UISkillManifest {
  id: string
  name: string
  version: string
  description: string
  category: 'filesystem' | 'browser' | 'cross_runtime' | string
  riskLevel: 'low' | 'medium' | 'high' | 'critical' | string
  inputs: Record<string, UISkillField>
  outputs: Record<string, { name: string; type: string; description?: string }>
  requiredCapabilities: string[]
  verification: {
    strategy: string
    conditions: string[]
  }
}

// Built-in manifest catalog fallback for immediate local responsiveness
const DEFAULT_SKILL_CATALOG: UISkillManifest[] = [
  {
    id: 'find-files',
    name: 'Find Files',
    version: '1.0.0',
    description: 'Search for files in a directory matching specific names, extensions, or content patterns.',
    category: 'filesystem',
    riskLevel: 'low',
    inputs: {
      directory: { name: 'directory', type: 'path', description: 'Root directory to search within', required: true, promptQuestion: 'Which folder would you like to search in?' },
      pattern: { name: 'pattern', type: 'string', description: 'File name pattern (e.g. *.pdf)', required: false, default: '*' },
    },
    outputs: {
      matchingFiles: { name: 'matchingFiles', type: 'array', description: 'Matching file paths' },
      count: { name: 'count', type: 'number', description: 'Number of files found' },
    },
    requiredCapabilities: ['read_file'],
    verification: { strategy: 'file_exists', conditions: ['Search directory was accessible'] },
  },
  {
    id: 'organize-downloads',
    name: 'Organize Downloads',
    version: '1.0.0',
    description: 'Categorize and organize files in a folder into subfolders grouped by file type or extension.',
    category: 'filesystem',
    riskLevel: 'medium',
    inputs: {
      folder: { name: 'folder', type: 'path', description: 'Folder to organize (e.g. ~/Downloads)', required: true, promptQuestion: 'Which folder would you like to organize?' },
      groupBy: { name: 'groupBy', type: 'string', description: 'Grouping strategy (extension or date)', required: false, default: 'extension' },
    },
    outputs: {
      organizedCount: { name: 'organizedCount', type: 'number', description: 'Number of files organized' },
    },
    requiredCapabilities: ['read_file', 'write_file', 'move_file'],
    verification: { strategy: 'checksum', conditions: ['Destination files exist and source files removed'] },
  },
  {
    id: 'bulk-rename-files',
    name: 'Bulk Rename Files',
    version: '1.0.0',
    description: 'Batch rename files in a folder according to a consistent naming pattern or timestamp.',
    category: 'filesystem',
    riskLevel: 'medium',
    inputs: {
      folder: { name: 'folder', type: 'path', description: 'Directory containing files to rename', required: true, promptQuestion: 'Which directory contains the files you want to rename?' },
      pattern: { name: 'pattern', type: 'string', description: 'Glob pattern matching target files', required: true, promptQuestion: 'What pattern matches the files to rename (e.g. *.png)?' },
      replacementTemplate: { name: 'replacementTemplate', type: 'string', description: 'Template for new names', required: true, promptQuestion: 'What naming template should be used?' },
    },
    outputs: {
      renamedCount: { name: 'renamedCount', type: 'number', description: 'Number of files renamed' },
    },
    requiredCapabilities: ['read_file', 'move_file'],
    verification: { strategy: 'checksum', conditions: ['Renamed files match target pattern'] },
  },
  {
    id: 'duplicate-file-detection',
    name: 'Duplicate File Detection',
    version: '1.0.0',
    description: 'Scan a directory for identical duplicate files by comparing file sizes and content hashes without deleting.',
    category: 'filesystem',
    riskLevel: 'low',
    inputs: {
      folder: { name: 'folder', type: 'path', description: 'Folder to scan for duplicates', required: true, promptQuestion: 'Which folder should I inspect for duplicate files?' },
    },
    outputs: {
      duplicates: { name: 'duplicates', type: 'array', description: 'Sets of duplicate file paths' },
    },
    requiredCapabilities: ['read_file'],
    verification: { strategy: 'state_check', conditions: ['Duplicates identified share identical hashes'] },
  },
  {
    id: 'research-website',
    name: 'Research Website',
    version: '1.0.0',
    description: 'Navigate to a target website, extract headings, articles, and summarize key insights.',
    category: 'browser',
    riskLevel: 'low',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Website URL to research', required: true, promptQuestion: 'What website URL should I research?' },
      topic: { name: 'topic', type: 'string', description: 'Specific focus area or question', required: false, default: 'General Summary' },
    },
    outputs: {
      summary: { name: 'summary', type: 'string', description: 'Research summary text' },
    },
    requiredCapabilities: ['navigate_website', 'extract_web_data'],
    verification: { strategy: 'dom_check', conditions: ['Page content extracted and summarized'] },
  },
  {
    id: 'extract-website-data',
    name: 'Extract Website Data',
    version: '1.0.0',
    description: 'Extract structured product names, tables, or records from a web page.',
    category: 'browser',
    riskLevel: 'low',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Web page containing tabular or product data', required: true, promptQuestion: 'What web page should I extract data from?' },
      fields: { name: 'fields', type: 'array', description: 'List of field names to extract', required: true, promptQuestion: 'What fields should I extract (e.g. name, price)?' },
    },
    outputs: {
      records: { name: 'records', type: 'array', description: 'Extracted structured data records' },
    },
    requiredCapabilities: ['navigate_website', 'extract_web_data'],
    verification: { strategy: 'dom_check', conditions: ['Records extracted with non-empty attributes'] },
  },
  {
    id: 'download-documents',
    name: 'Download Documents',
    version: '1.0.0',
    description: 'Locate document links (PDF, CSV, Office docs) on a web page and save them to a local destination directory.',
    category: 'browser',
    riskLevel: 'medium',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Web page containing documents', required: true, promptQuestion: 'Which web page contains the documents to download?' },
      targetDirectory: { name: 'targetDirectory', type: 'path', description: 'Local folder to save documents to', required: true, promptQuestion: 'Which folder should the downloaded documents be saved to?' },
    },
    outputs: {
      downloadedFiles: { name: 'downloadedFiles', type: 'array', description: 'List of saved files' },
    },
    requiredCapabilities: ['navigate_website', 'download_file'],
    verification: { strategy: 'file_exists', conditions: ['Downloaded files exist on disk with valid file headers'] },
  },
  {
    id: 'fill-web-form',
    name: 'Fill Web Form',
    version: '1.0.0',
    description: 'Populate inputs and textareas on a web page with provided values. Mandatory approval is enforced before final submission.',
    category: 'browser',
    riskLevel: 'high',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Web page containing the form', required: true, promptQuestion: 'What is the URL of the form you want to fill?' },
      formData: { name: 'formData', type: 'object', description: 'Map of field labels to values', required: true, promptQuestion: 'What information should I enter into the form fields?' },
      submitAfterFill: { name: 'submitAfterFill', type: 'boolean', description: 'Click final Submit (requires approval)', required: false, default: false },
    },
    outputs: {
      fieldsFilled: { name: 'fieldsFilled', type: 'array', description: 'Fields populated' },
    },
    requiredCapabilities: ['navigate_website', 'extract_web_data'],
    verification: { strategy: 'dom_check', conditions: ['Target form fields contain expected values'] },
  },
  {
    id: 'download-and-organize',
    name: 'Download and Organize',
    version: '1.0.0',
    description: 'Download documents from a target web page and automatically organize them into categorized subfolders on the local filesystem.',
    category: 'cross_runtime',
    riskLevel: 'medium',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Web page URL to download from', required: true, promptQuestion: 'Which web page should I download files from?' },
      destinationFolder: { name: 'destinationFolder', type: 'path', description: 'Local directory to organize into', required: true, promptQuestion: 'Which local folder should the organized files be placed into?' },
    },
    outputs: {
      downloadedCount: { name: 'downloadedCount', type: 'number', description: 'Count of files saved and organized' },
    },
    requiredCapabilities: ['navigate_website', 'download_file', 'move_file'],
    verification: { strategy: 'file_exists', conditions: ['Files downloaded and categorized into target folder'] },
  },
  {
    id: 'research-and-save-report',
    name: 'Research and Save Report',
    version: '1.0.0',
    description: 'Navigate to a target website, analyze content, generate a structured markdown report, and write it to disk.',
    category: 'cross_runtime',
    riskLevel: 'medium',
    inputs: {
      url: { name: 'url', type: 'url', description: 'Website URL to research', required: true, promptQuestion: 'What website URL should I research?' },
      topic: { name: 'topic', type: 'string', description: 'Focus area of the report', required: true, promptQuestion: 'What specific topic should the report focus on?' },
      outputFilePath: { name: 'outputFilePath', type: 'path', description: 'File path on disk to save report', required: true, promptQuestion: 'Where should the research report file be saved?' },
    },
    outputs: {
      filePath: { name: 'filePath', type: 'string', description: 'Path to saved report' },
    },
    requiredCapabilities: ['navigate_website', 'extract_web_data', 'write_file'],
    verification: { strategy: 'file_exists', conditions: ['Report written to disk with non-empty content'] },
  },
]

export function SkillsRoute() {
  const [skills, setSkills] = useState<UISkillManifest[]>(DEFAULT_SKILL_CATALOG)
  const [selectedSkill, setSelectedSkill] = useState<UISkillManifest>(DEFAULT_SKILL_CATALOG[1] ?? (DEFAULT_SKILL_CATALOG[0] as UISkillManifest))
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [formInputs, setFormInputs] = useState<Record<string, string>>({})
  const [executionState, setExecutionState] = useState<'idle' | 'planning' | 'running' | 'verifying' | 'completed' | 'failed'>('idle')
  const [missingQuestion, setMissingQuestion] = useState<string | null>(null)

  useEffect(() => {
    // Send skill.list query to websocket
    try {
      wsManager.send({ type: 'skill.list', payload: {} })
    } catch {
      // WS not connected yet
    }

    const unsub = wsManager.on('skill.list.result', (event: unknown) => {
      const e = event as { payload?: { skills?: UISkillManifest[] } }
      if (e?.payload?.skills && e.payload.skills.length > 0) {
        setSkills(e.payload.skills)
      }
    })

    return () => {
      unsub()
    }
  }, [])

  // Reset inputs when skill changes
  useEffect(() => {
    const initial: Record<string, string> = {}
    if (selectedSkill?.inputs) {
      for (const [key, field] of Object.entries(selectedSkill.inputs)) {
        if (field.default !== undefined) {
          initial[key] = String(field.default)
        }
      }
    }
    setFormInputs(initial)
    setExecutionState('idle')
    setMissingQuestion(null)
  }, [selectedSkill])

  const filteredSkills = skills.filter((s) => {
    if (categoryFilter === 'all') return true
    return s.category === categoryFilter
  })

  const handleInputChange = (key: string, value: string) => {
    setFormInputs((prev) => ({ ...prev, [key]: value }))
    if (missingQuestion) setMissingQuestion(null)
  }

  const handleRunSkill = () => {
    // Check if required inputs are supplied
    for (const [key, field] of Object.entries(selectedSkill.inputs)) {
      if (field.required && (!formInputs[key] || formInputs[key].trim() === '')) {
        setMissingQuestion(field.promptQuestion ?? `Please specify ${field.name}`)
        return
      }
    }

    setMissingQuestion(null)
    setExecutionState('planning')

    // Simulate / invoke execution pipeline
    setTimeout(() => {
      setExecutionState('running')
      setTimeout(() => {
        setExecutionState('verifying')
        setTimeout(() => {
          setExecutionState('completed')
        }, 1200)
      }, 1500)
    }, 800)
  }

  return (
    <div className="skills-view">
      {/* Sidebar: Available Skills Catalog */}
      <div className="skills-sidebar">
        <div className="skills-sidebar__header">
          <h2 className="skills-sidebar__title">Available Skills</h2>
          <p className="skills-sidebar__subtitle">Reusable automated computer operator capabilities</p>
        </div>

        <div className="skills-sidebar__categories">
          {['all', 'filesystem', 'browser', 'cross_runtime'].map((cat) => (
            <button
              key={cat}
              className={`skills-category-chip ${categoryFilter === cat ? 'skills-category-chip--active' : ''}`}
              onClick={() => setCategoryFilter(cat)}
            >
              {cat === 'all' ? 'All' : cat === 'cross_runtime' ? 'Cross-Runtime' : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="skills-list">
          {filteredSkills.map((skill) => {
            const isSelected = selectedSkill?.id === skill.id
            return (
              <div
                key={skill.id}
                className={`skill-card ${isSelected ? 'skill-card--selected' : ''}`}
                onClick={() => setSelectedSkill(skill)}
              >
                <div className="skill-card__header">
                  <h3 className="skill-card__title">{skill.name}</h3>
                  <span className={`skill-card__risk skill-card__risk--${skill.riskLevel}`}>
                    {skill.riskLevel}
                  </span>
                </div>
                <p className="skill-card__desc">{skill.description}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Main Panel: Selected Skill Execution & Configuration */}
      <div className="skills-detail">
        {selectedSkill && (
          <>
            <div className="skills-detail__hero">
              <div className="skills-detail__badge-row">
                <span className="skills-badge">{selectedSkill.category}</span>
                <span className="skills-badge">v{selectedSkill.version}</span>
                <span className={`skill-card__risk skill-card__risk--${selectedSkill.riskLevel}`}>
                  {selectedSkill.riskLevel} risk
                </span>
              </div>
              <h1 className="skills-detail__name">{selectedSkill.name}</h1>
              <p className="skills-detail__description">{selectedSkill.description}</p>
            </div>

            {/* Missing Info Prompt */}
            {missingQuestion && (
              <div className="skills-missing-prompt">
                <p className="skills-missing-prompt__heading">I need one thing:</p>
                <p className="skills-missing-prompt__question">{missingQuestion}</p>
              </div>
            )}

            {/* Status Pipeline Display */}
            <div className="skills-status-pipeline">
              <div className={`skills-step ${executionState === 'planning' ? 'skills-step--active' : executionState !== 'idle' ? 'skills-step--completed' : ''}`}>
                <div className="skills-step__indicator">1</div>
                <span>Planning</span>
              </div>
              <div>→</div>
              <div className={`skills-step ${executionState === 'running' ? 'skills-step--active' : (executionState === 'verifying' || executionState === 'completed') ? 'skills-step--completed' : ''}`}>
                <div className="skills-step__indicator">2</div>
                <span>Running</span>
              </div>
              <div>→</div>
              <div className={`skills-step ${executionState === 'verifying' ? 'skills-step--active' : executionState === 'completed' ? 'skills-step--completed' : ''}`}>
                <div className="skills-step__indicator">3</div>
                <span>Verifying</span>
              </div>
              <div>→</div>
              <div className={`skills-step ${executionState === 'completed' ? 'skills-step--completed' : ''}`}>
                <div className="skills-step__indicator">✓</div>
                <span>Completed</span>
              </div>
            </div>

            {/* Input Configuration Form */}
            <div className="skills-section">
              <h2 className="skills-section__title">Configure Parameters</h2>
              {(Object.entries(selectedSkill.inputs) as [string, UISkillField][]).map(([key, field]) => (
                <div key={key} className="skills-field">
                  <label className="skills-field__label">
                    {field.name}
                    {field.required && <span className="skills-field__required">*</span>}
                  </label>
                  <input
                    type="text"
                    className="skills-field__input"
                    value={formInputs[key] ?? ''}
                    placeholder={field.promptQuestion ?? field.description}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                  />
                  {field.description && (
                    <p className="skills-field__help">{field.description}</p>
                  )}
                </div>
              ))}

              <div style={{ marginTop: '24px' }}>
                <button
                  className="skills-run-btn"
                  onClick={handleRunSkill}
                  disabled={executionState === 'planning' || executionState === 'running' || executionState === 'verifying'}
                >
                  {executionState === 'planning'
                    ? 'Formulating Plan...'
                    : executionState === 'running'
                      ? 'Executing Tasks...'
                      : executionState === 'verifying'
                        ? 'Verifying Outcome...'
                        : executionState === 'completed'
                          ? 'Run Again'
                          : `Execute ${selectedSkill.name}`}
                </button>
              </div>
            </div>

            {/* Verification & Safety Guarantees */}
            <div className="skills-section">
              <h2 className="skills-section__title">Outcome Verification & Safety</h2>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                <p><strong>Strategy:</strong> {selectedSkill.verification.strategy}</p>
                <p><strong>Conditions:</strong></p>
                <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
                  {selectedSkill.verification.conditions.map((cond: string, idx: number) => (
                    <li key={idx}>{cond}</li>
                  ))}
                </ul>
                <p style={{ marginTop: '12px' }}>
                  <strong>Required Capabilities:</strong> {selectedSkill.requiredCapabilities.join(', ')}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
