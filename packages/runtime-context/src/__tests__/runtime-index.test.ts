import { describe, it, expect } from 'vitest'

import { createProvenance } from '../core/provenance'
import { RuntimeIndexEngine } from '../index/runtime-index'
import type { IndexDocument } from '../index/types'

describe('Runtime Index & Hybrid Search (Deliverable 5)', () => {
  it('indexes documents and performs keyword and entity type filtering', () => {
    const index = new RuntimeIndexEngine()
    const prov = createProvenance('filesystem')

    const doc1: IndexDocument = {
      id: 'idx-1',
      entityType: 'pdf',
      title: 'Amazon GST Tax Invoice Jan 2026',
      content: 'Invoice Number: INV-2026-001. Total Amount: 1450.00 INR with CGST and SGST included.',
      tags: ['invoice', 'gst', 'amazon'],
      provenance: prov,
      indexedAt: 1000,
    }

    const doc2: IndexDocument = {
      id: 'idx-2',
      entityType: 'download',
      title: 'Quarterly Sales Expense Report',
      content: 'Summary of travel, food, and lodging expenses for Q1 2026.',
      tags: ['expenses', 'finance'],
      provenance: prov,
      indexedAt: 1500,
    }

    const doc3: IndexDocument = {
      id: 'idx-3',
      entityType: 'ocr',
      title: 'Receipt Scan #48',
      content: 'Hotel checkout bill and restaurant food receipt.',
      tags: ['receipt', 'hotel'],
      provenance: prov,
      indexedAt: 2000,
    }

    index.indexBatch([doc1, doc2, doc3])
    expect(index.count()).toBe(3)
    expect(index.count('pdf')).toBe(1)

    // Search query for invoice
    const invoiceResults = index.search({ query: 'GST Invoice' })
    expect(invoiceResults.length).toBeGreaterThanOrEqual(1)
    expect(invoiceResults[0]?.document.id).toBe('idx-1')
    expect(invoiceResults[0]?.highlights.length).toBeGreaterThan(0)

    // Entity type filtering
    const downloadOnly = index.search({ query: 'report', entityTypes: ['download'] })
    expect(downloadOnly.length).toBe(1)
    expect(downloadOnly[0]?.document.entityType).toBe('download')

    // Tag filtering
    const tagFiltered = index.search({ query: '', tags: ['receipt'] })
    expect(tagFiltered.length).toBe(1)
    expect(tagFiltered[0]?.document.id).toBe('idx-3')
  })

  it('supports vector cosine similarity scoring', () => {
    const index = new RuntimeIndexEngine()
    const prov = createProvenance('execution')

    const vecA = [1.0, 0.0, 0.0]
    const vecB = [0.0, 1.0, 0.0]

    index.index({
      id: 'vec-doc-1',
      entityType: 'document',
      title: 'Frontend Architecture',
      content: 'React, TypeScript, state management',
      tags: ['frontend'],
      vector: vecA,
      provenance: prov,
      indexedAt: 1000,
    })

    index.index({
      id: 'vec-doc-2',
      entityType: 'document',
      title: 'Database Schema',
      content: 'SQL, SQLite, migrations',
      tags: ['database'],
      vector: vecB,
      provenance: prov,
      indexedAt: 1000,
    })

    // Search with vector close to vecA
    const searchVec = [0.95, 0.05, 0.0]
    const results = index.search({ query: '', vector: searchVec })
    expect(results.length).toBe(2)
    expect(results[0]?.document.id).toBe('vec-doc-1')
  })
})
