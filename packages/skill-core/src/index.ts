// @usepilot/skill-core — Public API

export { SkillRegistry, type SkillValidationResult, type SkillAvailability } from './registry/skill-registry'
export { SkillDiscovery } from './discovery/skill-discovery'
export { SkillResolver } from './resolver/skill-resolver'
export { SkillParameterExtractor } from './resolver/parameter-extractor'
export { SkillWorkflowCompiler, type CompiledSkillResult } from './workflow/compiler'
export { SkillVerifier, type SkillVerificationResult, type ConditionEvaluation } from './verification/skill-verifier'
export { SkillTelemetryCollector, type SkillAggregatedMetrics } from './telemetry/skill-telemetry'
export { SkillComposer, type ComposedWorkflowResult } from './composition/composer'

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
