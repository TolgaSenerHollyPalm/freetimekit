import { describe, expect, it } from 'vitest'
import { answerQuestion, openCard } from '../cards/progress.ts'
import { at, card, dayLog, opened } from '../cards/test-helpers.ts'
import { mergeDays, mergeOne, mergeProgress, mergeSettings } from './merge.ts'

describe('merging progress', () => {
  it('goes field by field: the earlier opening and finishing, every answer, the newer stamp', () => {
    const mine = { ...opened('tarih-001', '2026-09-20'), answers: { q1: 0, q2: 1 }, updatedAt: at('2026-09-25') }
    const theirs = { ...opened('tarih-001', '2026-09-18', true), answers: { q2: 3, q3: 2 }, updatedAt: at('2026-09-22') }
    expect(mergeOne(mine, theirs)).toEqual({
      cardId: 'tarih-001',
      openedAt: at('2026-09-18'),
      answers: { q1: 0, q2: 3, q3: 2 }, // the finished side wins where both have an answer
      completedAt: theirs.completedAt,
      updatedAt: at('2026-09-25'),
    })
  })

  it('never loses a finish, and keeps the device’s answer when both or neither finished', () => {
    const mine = { ...opened('a', '2026-09-20', true), answers: { q1: 0 } }
    const theirs = { ...opened('a', '2026-09-21'), answers: { q1: 2, q2: 1 } }
    expect(mergeOne(mine, theirs)).toMatchObject({ completedAt: mine.completedAt, answers: { q1: 0, q2: 1 } })
    expect(mergeOne({ ...mine, completedAt: undefined }, theirs).completedAt).toBeUndefined()
    expect(mergeOne({ ...opened('a', '2026-09-20'), answers: { q1: 0 } }, theirs).answers).toEqual({ q1: 0, q2: 1 })
  })

  it('adds the cards only the backup has and counts what changed', () => {
    const result = mergeProgress([opened('a', '2026-09-20')], [opened('a', '2026-09-20'), opened('b', '2026-09-21', true)])
    expect(result.items.map((p) => p.cardId)).toEqual(['a', 'b'])
    expect([result.added, result.updated]).toEqual([1, 0])
  })

  it('counts a finished card the backup has as it is as unchanged, whatever the order of its fields', () => {
    const quiz = card('tarih-001', { questions: 1 })
    const now = new Date(at('2026-09-29'))
    const { progress } = answerQuestion(openCard(undefined, quiz.id, now), quiz, quiz.questions[0].id, 0, now)
    const copy = JSON.parse(JSON.stringify(mergeOne(progress, progress))) as typeof progress
    expect(Object.keys(copy)).not.toEqual(Object.keys(progress))
    const result = mergeProgress([progress], [copy])
    expect([result.added, result.updated]).toEqual([0, 0])
    expect(result.items[0]).toBe(progress)
  })
})

describe('merging days', () => {
  it('joins the counted cards of both and keeps the device’s own choice of card', () => {
    const mine = dayLog('2026-09-29', 'tarih-001', ['tarih-001'], { suggestedCardIds: ['x'] })
    const theirs = dayLog('2026-09-29', 'bilim-002', ['bilim-002'], { suggestedCardIds: ['y'], repeat: true })
    const result = mergeDays([mine], [theirs, dayLog('2026-09-28', 'doga-001', ['doga-001'])])
    expect(result.items.find((d) => d.date === '2026-09-29')).toMatchObject({ dailyCardId: 'tarih-001', repeat: false, suggestedCardIds: ['x'], countedCardIds: ['tarih-001', 'bilim-002'] })
    expect([result.added, result.updated]).toEqual([1, 1])
  })

  it('gives a day the device opened before it had cards the backup’s card and suggestions', () => {
    const mine = dayLog('2026-09-29')
    const theirs = dayLog('2026-09-29', 'bilim-002', [], { suggestedCardIds: ['tarih-001'] })
    const result = mergeDays([mine], [theirs])
    expect(result.items[0]).toMatchObject({ dailyCardId: 'bilim-002', suggestedCardIds: ['tarih-001'], countedCardIds: [] })
    expect(result.updated).toBe(1)
  })

  it('changes nothing when the backup brings no new counted card', () => {
    const mine = dayLog('2026-09-29', 'a', ['a', 'b'])
    expect(mergeDays([mine], [dayLog('2026-09-29', 'z', ['b'])])).toEqual({ items: [mine], added: 0, updated: 0 })
  })
})

describe('merging settings', () => {
  it('keeps the newer; the welcome’s unstamped ones give way to a backup’s', () => {
    const welcome = { interests: ['tarih'] }
    const stamped = { interests: ['bilim'], updatedAt: at('2026-09-20') }
    expect(mergeSettings(welcome, stamped)).toEqual({ settings: stamped, changed: true })
    expect(mergeSettings(stamped, welcome)).toEqual({ settings: stamped, changed: false })
    expect(mergeSettings(stamped, { interests: ['doga'], updatedAt: at('2026-09-25') }).settings?.interests).toEqual(['doga'])
    expect(mergeSettings(welcome, { interests: ['sanat'] }).settings?.interests).toEqual(['sanat'])
    expect(mergeSettings(undefined, welcome)).toEqual({ settings: welcome, changed: true })
    expect(mergeSettings(welcome, undefined)).toEqual({ settings: welcome, changed: false })
  })
})
