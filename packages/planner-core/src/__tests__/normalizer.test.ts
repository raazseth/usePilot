import { describe, it, expect } from 'vitest'
import { Normalizer } from '../normalizer/normalizer'

describe('Normalizer', () => {
  const normalizer = new Normalizer()

  it('collapses consecutive whitespace and trims ends', () => {
    const raw = '   Download   all   invoices    from   Amazon   '
    const result = normalizer.normalize(raw)
    expect(result.text).toBe('Download all invoices from Amazon')
    expect(result.originalText).toBe(raw)
  })

  it('extracts URL entities correctly', () => {
    const raw = 'Go to https://amazon.com/orders and download receipt'
    const result = normalizer.normalize(raw)
    const urlEntity = result.entities.find((e) => e.type === 'url')
    expect(urlEntity).toBeDefined()
    expect(urlEntity?.normalized).toBe('https://amazon.com/orders')
  })

  it('extracts email entities correctly', () => {
    const raw = 'Send summary report to billing@company.org'
    const result = normalizer.normalize(raw)
    const emailEntity = result.entities.find((e) => e.type === 'email')
    expect(emailEntity).toBeDefined()
    expect(emailEntity?.normalized).toBe('billing@company.org')
  })

  it('detects English and non-English scripts', () => {
    const en = normalizer.normalize('Download files from server')
    expect(en.detectedLanguage).toBe('en')

    const hi = normalizer.normalize('सभी बिल डाउनलोड करो')
    expect(hi.detectedLanguage).toBe('non-en')
  })

  it('detects currency amounts', () => {
    const raw = 'Approve payment of $250.00 for office supplies'
    const result = normalizer.normalize(raw)
    const amountEntity = result.entities.find((e) => e.type === 'currency')
    expect(amountEntity).toBeDefined()
  })
})
