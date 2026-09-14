import { createWorker } from 'tesseract.js'
import type { Worker } from 'tesseract.js'

export interface BoundingBox {
  x: number
  y: number
  width: number
  height: number
}

export interface OCRWord {
  text: string
  confidence: number
  bbox: BoundingBox
}

export interface OCRResult {
  fullText: string
  words: OCRWord[]
}

export interface TemplateMatchResult {
  found: boolean
  confidence: number
  bbox?: BoundingBox | undefined
}

export type AnchorRelation = 'right_of' | 'left_of' | 'above' | 'below'

export class VisionSubsystem {
  private ocrWorkerPromise: Promise<Worker> | null = null

  private async getWorker(): Promise<Worker> {
    if (!this.ocrWorkerPromise) {
      this.ocrWorkerPromise = (async () => {
        const worker = await createWorker('eng')
        return worker
      })()
    }
    return this.ocrWorkerPromise
  }

  async recognizeText(imageBuffer: Buffer): Promise<OCRResult> {
    try {
      const worker = await this.getWorker()
      const ret = await worker.recognize(imageBuffer)
      const data = ret.data as unknown as { text?: string; words?: Array<{ text: string; confidence: number; bbox: { x0: number; y0: number; x1: number; y1: number } }> }

      const words: OCRWord[] = []
      if (data && Array.isArray(data.words)) {
        for (const w of data.words) {
          words.push({
            text: w.text,
            confidence: w.confidence,
            bbox: {
              x: w.bbox.x0,
              y: w.bbox.y0,
              width: w.bbox.x1 - w.bbox.x0,
              height: w.bbox.y1 - w.bbox.y0,
            },
          })
        }
      }

      return {
        fullText: data?.text ?? '',
        words,
      }
    } catch {
      return {
        fullText: '',
        words: [],
      }
    }
  }

  async findTextLocation(imageBuffer: Buffer, targetText: string): Promise<BoundingBox | undefined> {
    const ocr = await this.recognizeText(imageBuffer)
    const normalizedTarget = targetText.trim().toLowerCase()

    for (const w of ocr.words) {
      if (w.text.toLowerCase().includes(normalizedTarget)) {
        return w.bbox
      }
    }

    // Check multi-word phrase
    const targetWords = normalizedTarget.split(/\s+/).filter(Boolean)
    if (targetWords.length > 1) {
      const firstWord = targetWords[0]!
      for (let i = 0; i < ocr.words.length; i++) {
        if (ocr.words[i]!.text.toLowerCase().includes(firstWord)) {
          let allMatch = true
          for (let j = 1; j < targetWords.length; j++) {
            if (!ocr.words[i + j] || !ocr.words[i + j]!.text.toLowerCase().includes(targetWords[j]!)) {
              allMatch = false
              break
            }
          }
          if (allMatch) {
            const startBox = ocr.words[i]!.bbox
            const endBox = ocr.words[i + targetWords.length - 1]!.bbox
            return {
              x: startBox.x,
              y: Math.min(startBox.y, endBox.y),
              width: Math.max(startBox.width, (endBox.x + endBox.width) - startBox.x),
              height: Math.max(startBox.height, endBox.height),
            }
          }
        }
      }
    }

    return undefined
  }

  findTemplate(
    _sourceBuffer: Buffer,
    _templateBuffer: Buffer,
    _threshold = 0.8
  ): TemplateMatchResult {
    // Visual template matching is safely disabled to prevent arbitrary coordinate hallucination.
    // Deterministic DOM selectors and OCR recognition are used for reliable element location.
    return { found: false, confidence: 0 }
  }

  resolveVisualAnchor(
    anchorBox: BoundingBox,
    relation: AnchorRelation,
    offsetPixels = 20
  ): { x: number; y: number } {
    switch (relation) {
      case 'right_of':
        return {
          x: anchorBox.x + anchorBox.width + offsetPixels,
          y: anchorBox.y + Math.floor(anchorBox.height / 2),
        }
      case 'left_of':
        return {
          x: Math.max(0, anchorBox.x - offsetPixels),
          y: anchorBox.y + Math.floor(anchorBox.height / 2),
        }
      case 'below':
        return {
          x: anchorBox.x + Math.floor(anchorBox.width / 2),
          y: anchorBox.y + anchorBox.height + offsetPixels,
        }
      case 'above':
        return {
          x: anchorBox.x + Math.floor(anchorBox.width / 2),
          y: Math.max(0, anchorBox.y - offsetPixels),
        }
    }
  }

  async dispose(): Promise<void> {
    if (this.ocrWorkerPromise) {
      try {
        const worker = await this.ocrWorkerPromise
        await worker.terminate()
      } catch {
        // Ignored
      }
      this.ocrWorkerPromise = null
    }
  }
}
