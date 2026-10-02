import { describe, expect, it } from 'vitest'
import { buildLibrary, cardCounts, categoryOf, isGone } from './library.ts'
import { card, index, pack } from './test-helpers.ts'

describe('the library', () => {
  const tarih1 = pack('tarih', [card('tarih-001'), card('tarih-002')], 1)
  const tarih2 = pack('tarih', [card('tarih-003')], 2)
  const bilim = pack('bilim', [card('bilim-001')])

  it('orders cards by the index’s packs, then the pack’s own order', () => {
    const library = buildLibrary(index([tarih1, bilim, tarih2]), [tarih2, bilim, tarih1])
    expect(library.byCategory.get('tarih')?.map((c) => c.id)).toEqual(['tarih-001', 'tarih-002', 'tarih-003'])
    expect(categoryOf(library, 'bilim-001')?.id).toBe('bilim')
  })

  it('tells a card a pack update took away from one whose pack has not arrived', () => {
    const updated = { ...tarih1, version: 2, cards: [tarih1.cards[0]] }
    const library = buildLibrary(index([updated, bilim]), [updated, bilim])
    expect(isGone(library, 'tarih-002')).toBe(true)
    expect(isGone(library, 'tarih-001')).toBe(false)
    expect(isGone(library, 'doga-001')).toBe(false)
  })

  it('counts a card’s parts the way Bugün shows them', () => {
    expect(cardCounts(card('tarih-001'))).toBe('3 bilgi · 3 soru · 2 tartışma')
  })
})
