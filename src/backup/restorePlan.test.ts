import { describe, expect, it } from 'vitest'
import { at, dayLog, opened } from '../cards/test-helpers.ts'
import type { CardProgress, WeekendItem } from '../cards/types.ts'
import { planRestore, restoredText, type KitData } from './restorePlan.ts'

const finished: CardProgress = { ...opened('tarih-001', '2026-09-20', true), answers: { 'tarih-001-q1': 0, 'tarih-001-q2': 1, 'tarih-001-q3': 0 } }
const halfway: CardProgress = { ...opened('bilim-002', '2026-09-21'), answers: { 'bilim-002-q1': 2 } }
const fromCard: WeekendItem = { id: 'w1', kind: 'card', cardId: 'tarih-001', title: 'Kart', category: 'tarih', addedAt: at('2026-09-20'), updatedAt: at('2026-09-20') }
const own: WeekendItem = { id: 'w2', kind: 'own', title: 'Tatil', questions: ['Nereye?'], addedAt: at('2026-09-22'), updatedAt: at('2026-09-22') }
const backup: KitData = {
  settings: { interests: ['tarih', 'bilim'], updatedAt: at('2026-09-19') },
  progress: [finished, halfway],
  days: [dayLog('2026-09-20', 'tarih-001', ['tarih-001']), dayLog('2026-09-21', 'bilim-002')],
  weekend: [fromCard, own],
}
const empty: KitData = { progress: [], days: [], weekend: [] }
const copy = (data: KitData): KitData => structuredClone(data)

const merged = (local: KitData, incoming = backup) => {
  const plan = planRestore(local, incoming, 'merge')
  return { plan, text: restoredText(plan.counts, 'merge') }
}

describe('replacing', () => {
  it('empties the device and writes the backup as it is', () => {
    const plan = planRestore(copy(backup), backup, 'replace')
    expect(plan).toMatchObject({ clear: true, progress: backup.progress, days: backup.days, weekend: backup.weekend, settings: backup.settings })
    expect(restoredText(plan.counts, 'replace')).toBe('Geri yüklendi: 1 biten kart, 2 konu.')
  })

  it('leaves no settings after a backup that had none, so the welcome comes again', () => {
    expect(planRestore(copy(backup), { ...backup, settings: undefined }, 'replace').settings).toBeUndefined()
  })
})

describe('merging', () => {
  it('adds everything to an empty device; a half-done card counts as a changed record', () => {
    const { plan, text } = merged(empty)
    expect(plan.clear).toBe(false)
    expect([plan.progress.length, plan.days.length, plan.weekend.length]).toEqual([2, 2, 2])
    expect(plan.settings).toEqual(backup.settings)
    expect(text).toBe('Geri yüklendi: 1 biten kart, 2 konu eklendi; 1 kayıt güncellendi.')
  })

  it('writes nothing when the device has it all, even from records parsed back from the file', () => {
    const { plan, text } = merged(copy(backup))
    expect([plan.progress, plan.days, plan.weekend]).toEqual([[], [], []])
    expect(text).toBe('Yedekteki her şey bu cihazda zaten var.')
  })

  it('counts a card the backup finished as an added finished card', () => {
    const local = { ...copy(backup), progress: [{ ...opened('tarih-001', '2026-09-20'), answers: { 'tarih-001-q1': 0 } }, halfway] }
    const { plan, text } = merged(local)
    expect(plan.progress).toHaveLength(1)
    expect(plan.progress[0]).toMatchObject({ cardId: 'tarih-001', completedAt: finished.completedAt })
    expect(text).toBe('Geri yüklendi: 1 biten kart eklendi.')
  })

  it('reports a newer topic as an updated record', () => {
    const newer = { ...own, title: 'Kamp', updatedAt: at('2026-09-25') }
    expect(merged(copy(backup), { ...backup, weekend: [fromCard, newer] }).text).toBe('Geri yüklendi: 1 kayıt güncellendi.')
  })

  it('names the streak and the settings when only days or settings changed', () => {
    const fewerDays = { ...copy(backup), days: [backup.days[0]] }
    expect(merged(fewerDays).text).toBe('Geri yüklendi: serin ve ayarların güncellendi.')
    const welcome = { ...copy(backup), settings: { interests: ['doga'] } }
    const { plan, text } = merged(welcome)
    expect(plan.settings).toEqual(backup.settings)
    expect(text).toBe('Geri yüklendi: serin ve ayarların güncellendi.')
  })

  it('keeps the device’s newer settings', () => {
    const mine = { interests: ['sanat'], updatedAt: at('2026-09-30') }
    expect(merged({ ...copy(backup), settings: mine }).plan.settings).toBe(mine)
  })
})
