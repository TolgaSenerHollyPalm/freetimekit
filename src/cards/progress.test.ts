import { describe, expect, it } from 'vitest'
import { answerQuestion, countDay, lastWeek, nextQuestion, openCard, scoreOf, streak, streakText, todayStatus } from './progress.ts'
import { addDays, dayTitle, daysBetween, fullDayName, lastDays, shortDayName, toDay } from './dates.ts'
import { card, dayLog, opened } from './test-helpers.ts'
import type { DayLog } from './types.ts'

const now = new Date('2026-09-30T08:00:00Z')
const days = (...logs: DayLog[]) => new Map(logs.map((log) => [log.date, log]))

describe('progress', () => {
  const gobekli = card('tarih-001', { answers: [2, 0, 2] })

  it('starts when the card is first opened and keeps that first date', () => {
    const first = openCard(undefined, 'tarih-001', now)
    expect(first).toEqual({ cardId: 'tarih-001', openedAt: now.toISOString(), answers: {}, updatedAt: now.toISOString() })
    expect(openCard(first, 'tarih-001', new Date('2026-10-01T08:00:00Z'))).toBe(first)
  })

  it('keeps each answer under its question id, and completes the card with the last one', () => {
    let progress = openCard(undefined, gobekli.id, now)
    for (const [i, choice] of [2, 1].entries()) {
      const result = answerQuestion(progress, gobekli, gobekli.questions[i].id, choice, now)
      expect(result.completed).toBe(false)
      progress = result.progress
    }
    expect(nextQuestion(gobekli, progress)).toBe(2)
    const last = answerQuestion(progress, gobekli, 'tarih-001-q3', 2, now)
    expect(last.completed).toBe(true)
    expect(last.progress.answers).toEqual({ 'tarih-001-q1': 2, 'tarih-001-q2': 1, 'tarih-001-q3': 2 })
    expect(last.progress.completedAt).toBe(now.toISOString())
    expect(nextQuestion(gobekli, last.progress)).toBeUndefined()
    expect(scoreOf(gobekli, last.progress)).toEqual({ answered: 3, correct: 2, marks: [true, false, true] })
  })

  it('never takes a second answer to the same question', () => {
    const progress = answerQuestion(openCard(undefined, gobekli.id, now), gobekli, 'tarih-001-q1', 2, now).progress
    expect(answerQuestion(progress, gobekli, 'tarih-001-q1', 0, now)).toEqual({ progress, completed: false })
  })

  it('stays complete when a pack update changes the card’s questions, and counts only the current answered ones', () => {
    const done = { ...opened('tarih-001', '2026-09-20', true), answers: { 'tarih-001-q1': 2, 'tarih-001-q2': 0, 'tarih-001-q3': 1 } }
    const changed = { ...gobekli, questions: [gobekli.questions[0], gobekli.questions[2], { ...gobekli.questions[1], id: 'tarih-001-q4' }] }
    expect(scoreOf(changed, done)).toEqual({ answered: 2, correct: 1, marks: [true, false] })
    expect(done.completedAt).toBeDefined()
    expect(answerQuestion(done, changed, 'tarih-001-q4', 0, now).progress.completedAt).toBe(done.completedAt)
  })
})

describe('the streak', () => {
  it('counts from yesterday while today has not counted yet', () => {
    const log = days(dayLog('2026-09-28', 'a', ['a']), dayLog('2026-09-29', 'b', ['b']), dayLog('2026-09-30', 'c'))
    expect(streak(log, '2026-09-30')).toBe(2)
    expect(streak(days(...log.values(), dayLog('2026-09-30', 'c', ['c'])), '2026-09-30')).toBe(3)
  })

  it('is 0 after a day off, whatever came before', () => {
    expect(streak(days(dayLog('2026-09-27', 'a', ['a']), dayLog('2026-09-28', 'b', ['b'])), '2026-09-30')).toBe(0)
  })

  it('turns over at local midnight', () => {
    expect(toDay(new Date(2026, 8, 29, 23, 59, 59))).toBe('2026-09-29')
    expect(toDay(new Date(2026, 8, 30, 0, 0, 0))).toBe('2026-09-30')
    const log = days(dayLog('2026-09-29', 'a', ['a']))
    expect(streak(log, toDay(new Date(2026, 8, 29, 23, 59)))).toBe(1)
    expect(streak(log, toDay(new Date(2026, 8, 30, 0, 1)))).toBe(1)
    expect(streak(log, toDay(new Date(2026, 9, 1, 0, 1)))).toBe(0)
  })

  it('counts a repeat day once its card is opened', () => {
    const repeatDay = dayLog('2026-09-30', 'tarih-001', [], { repeat: true })
    expect(todayStatus(repeatDay, new Map([['tarih-001', opened('tarih-001', '2026-09-01', true)]]))).toBe('start')
    const counted = countDay(repeatDay, 'tarih-001', now)
    expect(streak(days(dayLog('2026-09-29', 'x', ['x']), counted), '2026-09-30')).toBe(2)
    expect(todayStatus(counted, new Map())).toBe('done')
    expect(countDay(counted, 'tarih-001', now)).toBe(counted)
  })

  it('reads as the plan’s badge', () => {
    expect([0, 1, 2, 5].map(streakText)).toEqual([undefined, 'Seri başladı', '2 gün üst üste', '5 gün üst üste'])
  })

  it('shows the last seven days with today last', () => {
    const week = lastWeek(days(dayLog('2026-09-24', 'a', ['a']), dayLog('2026-09-30', 'b', ['b'])), '2026-09-30')
    expect(week.map((d) => `${d.day}:${d.done}`)).toEqual(['2026-09-24:true', '2026-09-25:false', '2026-09-26:false', '2026-09-27:false', '2026-09-28:false', '2026-09-29:false', '2026-09-30:true'])
  })
})

describe('Bugün’s button', () => {
  it('starts, continues or opens the finished card', () => {
    const log = dayLog('2026-09-30', 'tarih-001')
    expect(todayStatus(log, new Map())).toBe('start')
    expect(todayStatus(log, new Map([['tarih-001', opened('tarih-001', '2026-09-30')]]))).toBe('continue')
    expect(todayStatus({ ...log, countedCardIds: ['tarih-001'] }, new Map())).toBe('done')
  })
})

describe('Turkish dates', () => {
  it('reads "Salı, 29 Eylül", not the ready-made "29 Eylül Salı"', () => {
    expect(dayTitle('2026-09-29')).toBe('Salı, 29 Eylül')
    expect(dayTitle('2026-10-04')).toBe('Pazar, 4 Ekim')
  })

  it('has the plan’s short day names and the full ones for screen readers', () => {
    expect(lastDays('2026-09-29').map(shortDayName)).toEqual(['Çar', 'Per', 'Cum', 'Cmt', 'Paz', 'Pzt', 'Sal'])
    expect(fullDayName('2026-09-23')).toBe('Çarşamba')
  })

  it('counts days across months and a daylight saving change', () => {
    expect(addDays('2026-09-30', 1)).toBe('2026-10-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
    expect(daysBetween('2026-03-28', '2026-03-30')).toBe(2)
    expect(daysBetween('2026-10-24', '2026-10-27')).toBe(3)
  })
})
