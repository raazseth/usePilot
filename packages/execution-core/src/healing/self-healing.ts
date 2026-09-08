import type { Page, Locator } from 'playwright'

import type { ExecutionJournal } from '../journal'
import type { VisionSubsystem } from '../vision/vision-subsystem'

export type HealingStrategy = 'dom' | 'semantic' | 'visual' | 'ocr'

export interface TargetElementDescription {
  selector?: string | undefined
  text?: string | undefined
  role?: string | undefined
  label?: string | undefined
  placeholder?: string | undefined
  templateImage?: Buffer | undefined
}

export interface HealingResult {
  found: boolean
  strategy?: HealingStrategy | undefined
  locator?: Locator | undefined
  coordinates?: { x: number; y: number } | undefined
  attempts: Array<{ strategy: HealingStrategy; success: boolean; durationMs: number; error?: string | undefined }>
}

export class SelfHealingPipeline {
  constructor(
    private readonly vision: VisionSubsystem,
    private readonly journal?: ExecutionJournal | undefined
  ) {}

  async locateElement(page: Page, target: TargetElementDescription, runId?: string | undefined): Promise<HealingResult> {
    const attempts: HealingResult['attempts'] = []

    // 1. DOM Lookup
    if (target.selector) {
      const start = Date.now()
      try {
        const locator = page.locator(target.selector).first()
        const isVisible = await locator.isVisible({ timeout: 1500 }).catch(() => false)
        if (isVisible) {
          attempts.push({ strategy: 'dom', success: true, durationMs: Date.now() - start })
          return { found: true, strategy: 'dom', locator, attempts }
        }
        attempts.push({ strategy: 'dom', success: false, durationMs: Date.now() - start, error: 'Element not visible' })
      } catch (err) {
        attempts.push({ strategy: 'dom', success: false, durationMs: Date.now() - start, error: String(err) })
      }
    }

    // 2. Semantic Lookup
    const semanticStart = Date.now()
    try {
      let locator: Locator | null = null
      if (target.text) {
        locator = page.getByText(target.text, { exact: false }).first()
      } else if (target.label) {
        locator = page.getByLabel(target.label).first()
      } else if (target.placeholder) {
        locator = page.getByPlaceholder(target.placeholder).first()
      }

      if (locator) {
        const isVisible = await locator.isVisible({ timeout: 1500 }).catch(() => false)
        if (isVisible) {
          attempts.push({ strategy: 'semantic', success: true, durationMs: Date.now() - semanticStart })
          this.logRecovery(runId, 'semantic', 'Resolved element via semantic text/label lookup')
          return { found: true, strategy: 'semantic', locator, attempts }
        }
      }
      attempts.push({ strategy: 'semantic', success: false, durationMs: Date.now() - semanticStart })
    } catch (err) {
      attempts.push({ strategy: 'semantic', success: false, durationMs: Date.now() - semanticStart, error: String(err) })
    }

    // Capture screenshot for visual/OCR stages
    let screenshotBuffer: Buffer | null = null
    try {
      screenshotBuffer = await page.screenshot({ timeout: 3000 })
    } catch {
      // Ignored
    }

    // 3. Visual Template Lookup
    if (screenshotBuffer && target.templateImage) {
      const visualStart = Date.now()
      const match = this.vision.findTemplate(screenshotBuffer, target.templateImage)
      if (match.found && match.bbox) {
        const coordinates = {
          x: match.bbox.x + Math.floor(match.bbox.width / 2),
          y: match.bbox.y + Math.floor(match.bbox.height / 2),
        }
        attempts.push({ strategy: 'visual', success: true, durationMs: Date.now() - visualStart })
        this.logRecovery(runId, 'visual', 'Resolved element via visual template matching')
        return { found: true, strategy: 'visual', coordinates, attempts }
      }
      attempts.push({ strategy: 'visual', success: false, durationMs: Date.now() - visualStart })
    }

    // 4. OCR Lookup
    if (screenshotBuffer && (target.text || target.label)) {
      const ocrStart = Date.now()
      const searchText = target.text ?? target.label ?? ''
      const bbox = await this.vision.findTextLocation(screenshotBuffer, searchText)
      if (bbox) {
        const coordinates = {
          x: bbox.x + Math.floor(bbox.width / 2),
          y: bbox.y + Math.floor(bbox.height / 2),
        }
        attempts.push({ strategy: 'ocr', success: true, durationMs: Date.now() - ocrStart })
        this.logRecovery(runId, 'ocr', `Resolved element via OCR recognition for "${searchText}"`)
        return { found: true, strategy: 'ocr', coordinates, attempts }
      }
      attempts.push({ strategy: 'ocr', success: false, durationMs: Date.now() - ocrStart })
    }

    return { found: false, attempts }
  }

  private logRecovery(runId: string | undefined, strategy: HealingStrategy, message: string): void {
    if (this.journal && runId) {
      this.journal.append({
        runId,
        traceId: runId,
        taskId: 'self-healing',
        eventType: 'state_transition',
        payload: {
          healingStrategy: strategy,
          message,
        },
      })
    }
  }
}
