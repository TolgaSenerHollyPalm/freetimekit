import { describe, expect, it } from 'vitest'
import { ensureDay, pickDaily, pickSuggestions, rotation, type Choice } from './daily.ts'
import { buildLibrary } from './library.ts'
import { card, dayLog, index, opened, pack, sampleLibrary } from './test-helpers.ts'
import type { CardProgress, DayLog } from './types.ts'

const TODAY = '2026-09-30'
const { library, packs } = sampleLibrary()

function choice(over: Partial<Choice> = {}): Choice {
  return { library, interests: ['tarih', 'bilim', 'doga'], progress: new Map(), days: [], today: TODAY, ...over }
}
const progressOf = (...records: CardProgress[]) => new Map(records.map((p) => [p.cardId, p]))
const seenAll = (category: string, completed = true) => [1, 2, 3].map((n) => opened(`${category}-00${n}`, '2026-09-01', completed))

describe('the category rotation', () => {
  it('puts categories that never gave a day’s card first, in the index’s order, then the longest without one', () => {
    const days = [dayLog('2026-09-28', 'tarih-001'), dayLog('2026-09-29', 'bilim-001')]
    expect(rotation(['tarih', 'bilim', 'doga', 'sanat'], days, TODAY)).toEqual(['doga', 'sanat', 'tarih', 'bilim'])
    expect(pickDaily(choice({ days }))).toEqual({ dailyCardId: 'doga-001', repeat: false })
  })

  it('takes a category’s cards in pack and card order, skipping the ones already seen', () => {
    const days = [dayLog('2026-09-29', 'bilim-001'), dayLog('2026-09-28', 'doga-001')]
    expect(pickDaily(choice({ days, progress: progressOf(opened('tarih-001', '2026-09-27', true)) }))).toEqual({ dailyCardId: 'tarih-002', repeat: false })
  })

  it('ignores today’s own record, so picking again later today follows the same order', () => {
    const days = [dayLog(TODAY, 'tarih-001')]
    expect(rotation(['tarih', 'bilim'], days, TODAY)).toEqual(['tarih', 'bilim'])
  })
})

describe('the day’s card', () => {
  it('moves on to other downloaded categories when the interests have nothing unseen left', () => {
    expect(pickDaily(choice({ interests: ['tarih'], progress: progressOf(...seenAll('tarih')) }))).toEqual({ dailyCardId: 'bilim-001', repeat: false })
  })

  it('then comes back to a card started but not finished, interests first and the oldest opening first', () => {
    const everything = [...seenAll('tarih'), ...seenAll('bilim'), ...seenAll('doga'), ...seenAll('sanat')]
    const progress = progressOf(...everything, opened('sanat-002', '2026-09-03'), opened('tarih-003', '2026-09-05'), opened('tarih-002', '2026-09-04'))
    expect(pickDaily(choice({ interests: ['tarih'], progress }))).toEqual({ dailyCardId: 'tarih-002', repeat: false })
    expect(pickDaily(choice({ interests: ['doga'], progress }))).toEqual({ dailyCardId: 'sanat-002', repeat: false })
  })

  it('is empty while no card is on the device', () => {
    const empty = buildLibrary(index([]), [])
    expect(pickDaily(choice({ library: empty }))).toEqual({ repeat: false })
  })

  it('on a repeat day brings back a finished card: never the day’s card first, then the longest away, interests first', () => {
    const everything = progressOf(...seenAll('tarih'), ...seenAll('bilim'), ...seenAll('doga'), ...seenAll('sanat'))
    const days = [dayLog('2026-09-20', 'bilim-001'), dayLog('2026-09-21', 'bilim-002'), dayLog('2026-09-22', 'bilim-003')]
    expect(pickDaily(choice({ interests: ['bilim'], progress: everything, days }))).toEqual({ dailyCardId: 'bilim-001', repeat: true })
    expect(pickDaily(choice({ interests: ['tarih'], progress: everything, days }))).toEqual({ dailyCardId: 'tarih-001', repeat: true })
  })
})

describe('Senin için seçtik', () => {
  it('takes one unseen card per interest in rotation order, the day’s category last', () => {
    expect(pickSuggestions(choice(), 'tarih-001')).toEqual(['bilim-001', 'doga-001', 'tarih-002'])
  })

  it('adds second cards of the same categories, then other categories, and may stay short', () => {
    expect(pickSuggestions(choice({ interests: ['tarih', 'bilim'] }), 'tarih-001')).toEqual(['bilim-001', 'tarih-002', 'bilim-002'])
    expect(pickSuggestions(choice({ interests: ['tarih'], progress: progressOf(opened('tarih-003', '2026-09-01')) }), 'tarih-001')).toEqual(['tarih-002', 'bilim-001', 'doga-001'])
    const onlyTarih = sampleLibrary(['tarih']).library
    expect(pickSuggestions(choice({ library: onlyTarih, interests: ['tarih'] }), 'tarih-001')).toEqual(['tarih-002', 'tarih-003'])
  })
})

describe('the day’s record', () => {
  const now = new Date('2026-09-30T08:00:00Z')

  it('is chosen once and stays the same through the day, even when the interests change', () => {
    const first = ensureDay(undefined, choice(), now)
    expect(first).toMatchObject({ date: TODAY, dailyCardId: 'tarih-001', repeat: false, suggestedCardIds: ['bilim-001', 'doga-001', 'tarih-002'], countedCardIds: [] })
    expect(ensureDay(first, choice({ interests: ['sanat'] }), now)).toBe(first)
  })

  it('fills an empty day once the packs arrive', () => {
    const empty = ensureDay(undefined, choice({ library: buildLibrary(index([]), []) }), now)
    expect(empty.dailyCardId).toBeUndefined()
    expect(empty.suggestedCardIds).toEqual([])
    const filled = ensureDay(empty, choice(), now)
    expect(filled).toMatchObject({ dailyCardId: 'tarih-001', suggestedCardIds: ['bilim-001', 'doga-001', 'tarih-002'] })
  })

  it('picks again when a pack update takes the day’s card away, and keeps the suggestions', () => {
    const log: DayLog = { ...dayLog(TODAY, 'tarih-002'), suggestedCardIds: ['bilim-001', 'doga-001', 'tarih-003'] }
    const updated = pack('tarih', [card('tarih-001'), card('tarih-003')], 1, 2)
    const others = packs.filter((p) => p.category !== 'tarih')
    const after = buildLibrary(index([updated, ...others]), [updated, ...others])
    const next = ensureDay(log, choice({ library: after, progress: progressOf(opened('tarih-002', '2026-09-30')) }), now)
    expect(next.dailyCardId).toBe('tarih-001')
    expect(next.suggestedCardIds).toEqual(log.suggestedCardIds)
  })

  it('keeps a day’s card whose pack has not arrived yet: it is late, not gone', () => {
    const log = dayLog(TODAY, 'sanat-001', [], { suggestedCardIds: ['a', 'b', 'c'] })
    const withoutSanat = sampleLibrary(['tarih', 'bilim']).library
    expect(ensureDay(log, choice({ library: withoutSanat }), now)).toBe(log)
  })

  it('tops up a short list when new cards arrive, leaving the ones already there', () => {
    const onlyTarih = sampleLibrary(['tarih']).library
    const log = ensureDay(undefined, choice({ library: onlyTarih, interests: ['tarih', 'bilim'] }), now)
    expect(log.suggestedCardIds).toEqual(['tarih-002', 'tarih-003'])
    const next = ensureDay(log, choice({ interests: ['tarih', 'bilim'] }), now)
    expect(next.suggestedCardIds).toEqual(['tarih-002', 'tarih-003', 'bilim-001'])
    expect(next.dailyCardId).toBe(log.dailyCardId)
  })
})
