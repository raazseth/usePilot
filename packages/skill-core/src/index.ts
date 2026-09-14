// @usepilot/skill-core — Public API

export { SkillRegistry, type SkillValidationResult, type SkillAvailability } from './registry/skill-registry'
export { SkillCompositionRegistry } from './registry/composition-registry'
export { SkillDiscovery } from './discovery/skill-discovery'
export { SkillResolver } from './resolver/skill-resolver'
export { SkillParameterExtractor } from './resolver/parameter-extractor'
export { SkillWorkflowCompiler, type CompiledSkillResult } from './workflow/compiler'
export { SkillVerifier, type SkillVerificationResult, type ConditionEvaluation } from './verification/skill-verifier'
export { SkillTelemetryCollector, type SkillAggregatedMetrics } from './telemetry/skill-telemetry'
export { SkillComposer, type ComposedWorkflowResult } from './composition/composer'
export { CompositionValidator } from './composition/composition-validator'
export { OutputCollector } from './composition/output-collector'
export { ComposedWorkflowOrchestrator, type OrchestrationOptions } from './composition/orchestrator'
export { GoalWorkflowRouter } from './composition/workflow-router'
export { extractPromptSignals, tokenizeNormalized, type PromptSignals } from './discovery/nlp-matcher'

// Built-in Skills
export {
  BUILTIN_SKILLS,
  createDefaultSkillRegistry,
  FindFilesSkill,
  OrganizeDownloadsSkill,
  BulkRenameFilesSkill,
  DuplicateDetectionSkill,
  ResearchWebsiteSkill,
  ExtractWebsiteDataSkill,
  DownloadDocumentsSkill,
  FillWebFormSkill,
  DownloadAndOrganizeSkill,
  ResearchAndSaveReportSkill,
} from './skills/builtin'

// Built-in Compositions
export {
  BUILTIN_COMPOSITIONS,
  createDefaultCompositionRegistry,
  AuditAndCleanDownloadsComposition,
  ResearchDownloadAndOrganizeComposition,
  FindAndRenameComposition,
} from './skills/builtin-compositions'
