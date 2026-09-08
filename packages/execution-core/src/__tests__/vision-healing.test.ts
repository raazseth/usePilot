import type { Page } from 'playwright'
import { describe, it, expect } from 'vitest'

import { SelfHealingPipeline } from '../healing/self-healing'
import { ExecutionJournal } from '../journal'
import { VisionSubsystem } from '../vision/vision-subsystem'

describe('VisionSubsystem & SelfHealingPipeline', () => {
  it('resolves visual anchors accurately', () => {
    const vision = new VisionSubsystem()
    const anchorBox = { x: 100, y: 200, width: 80, height: 40 }

    // Right of anchor (anchor.x + width + offset, anchor.y + height/2)
    const rightCoord = vision.resolveVisualAnchor(anchorBox, 'right_of', 15)
    expect(rightCoord).toEqual({ x: 195, y: 220 })

    // Left of anchor
    const leftCoord = vision.resolveVisualAnchor(anchorBox, 'left_of', 10)
    expect(leftCoord).toEqual({ x: 90, y: 220 })

    // Below anchor
    const belowCoord = vision.resolveVisualAnchor(anchorBox, 'below', 25)
    expect(belowCoord).toEqual({ x: 140, y: 265 })

    // Above anchor
    const aboveCoord = vision.resolveVisualAnchor(anchorBox, 'above', 20)
    expect(aboveCoord).toEqual({ x: 140, y: 180 })
  })

  it('performs template matching on image buffers', () => {
    const vision = new VisionSubsystem()
    const sourceBuffer = Buffer.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.repeat(50))
    const templateBuffer = Buffer.from('MNOPQRST')

    const match = vision.findTemplate(sourceBuffer, templateBuffer)
    expect(match.found).toBe(true)
    expect(match.confidence).toBeGreaterThanOrEqual(0.8)
    expect(match.bbox).toBeDefined()
  })

  it('cascades through self-healing recovery and records journal events', async () => {
    const journal = new ExecutionJournal()
    const vision = new VisionSubsystem()
    const pipeline = new SelfHealingPipeline(vision, journal)

    // Mock page with failing DOM and succeeding Semantic locator
    const mockPage = {
      locator: () => ({
        first: () => ({
          isVisible: async () => false, // DOM selector fails
        }),
      }),
      getByText: () => ({
        first: () => ({
          isVisible: async () => true, // Semantic text succeeds
        }),
      }),
      screenshot: async () => Buffer.from('fake-screenshot'),
    } as unknown as Page

    const result = await pipeline.locateElement(
      mockPage,
      { selector: '#missing-dynamic-id', text: 'Download GST Invoice' },
      'run-heal-1'
    )

    expect(result.found).toBe(true)
    expect(result.strategy).toBe('semantic')
    expect(result.attempts.length).toBe(2)
    expect(result.attempts[0]?.strategy).toBe('dom')
    expect(result.attempts[0]?.success).toBe(false)
    expect(result.attempts[1]?.strategy).toBe('semantic')
    expect(result.attempts[1]?.success).toBe(true)

    // Verify recovery logged to execution journal
    const entries = await journal.getByRun('run-heal-1')
    expect(entries.length).toBe(1)
    expect(entries[0]?.eventType).toBe('state_transition')
    expect(entries[0]?.payload['healingStrategy']).toBe('semantic')
  })
})
