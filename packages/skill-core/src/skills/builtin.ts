import type { Skill } from '@usepilot/skill-types'
import { SkillRegistry } from '../registry/skill-registry'
import { FindFilesSkill } from './filesystem/find-files'
import { OrganizeDownloadsSkill } from './filesystem/organize-downloads'
import { BulkRenameFilesSkill } from './filesystem/bulk-rename'
import { DuplicateDetectionSkill } from './filesystem/duplicate-detection'
import { ResearchWebsiteSkill } from './browser/research-website'
import { ExtractWebsiteDataSkill } from './browser/extract-data'
import { DownloadDocumentsSkill } from './browser/download-documents'
import { FillWebFormSkill } from './browser/fill-form'
import { DownloadAndOrganizeSkill } from './cross-runtime/download-and-organize'
import { ResearchAndSaveReportSkill } from './cross-runtime/research-and-save-report'

export const BUILTIN_SKILLS: readonly Skill[] = [
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
] as const

/**
 * Creates and initializes a SkillRegistry pre-populated with all 10 built-in skills.
 */
export function createDefaultSkillRegistry(): SkillRegistry {
  const registry = new SkillRegistry()
  for (const skill of BUILTIN_SKILLS) {
    registry.register(skill)
  }
  return registry
}

export {
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
}
