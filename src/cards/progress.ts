import type { Card } from '../packs/types.ts'
import { addDays, lastDays } from './dates.ts'
import type { CardProgress, Day, DayLog } from './types.ts'

/** The record a card gets when it is first opened; an opened card keeps its first date. */
export const openCard = (progress: CardProgress | undefined, cardId: string, now: Date): CardProgress =>
  progress ?? { cardId, openedAt: now.toISOString(), answers: {}, updatedAt: now.toISOString() }

/** The first question still to answer, or undefined when every one has an answer. */
export const nextQuestion = (card: Card, progress: CardProgress | undefined): number | undefined => {
  const index = card.questions.findIndex((question) => progress?.answers[question.id] === undefined)
  return index === -1 ? undefined : index
}

/**
 * Saves one answer. An answered question cannot be answered again; once the card's current questions all have an
 * answer the card is complete, for good, even if a later pack changes its questions.
 */
export function answerQuestion(progress: CardProgress, card: Card, questionId: string, choice: number, now: Date): { progress: CardProgress; completed: boolean } {
  if (progress.answers[questionId] !== undefined) return { progress, completed: false }
  const answers = { ...progress.answers, [questionId]: choice }
  const all = card.questions.every((question) => answers[question.id] !== undefined)
  const completed = all && !progress.completedAt
  const stamp = now.toISOString()
  return { progress: { ...progress, answers, ...(completed && { completedAt: stamp }), updatedAt: stamp }, completed }
}

export interface Score {
  answered: number
  correct: number
  marks: boolean[] // right or wrong, in question order, for the answered ones
}

/** Counted over the card's current questions that have an answer. */
export function scoreOf(card: Card, progress: CardProgress | undefined): Score {
  const marks = card.questions.filter((q) => progress?.answers[q.id] !== undefined).map((q) => progress!.answers[q.id] === q.answerIndex)
  return { answered: marks.length, correct: marks.filter(Boolean).length, marks }
}

/** The day with this card among the ones that made it count. */
export const countDay = (log: DayLog, cardId: string, now: Date): DayLog =>
  log.countedCardIds.includes(cardId) ? log : { ...log, countedCardIds: [...log.countedCardIds, cardId], updatedAt: now.toISOString() }

export const isCounted = (log: DayLog | undefined): boolean => (log?.countedCardIds.length ?? 0) > 0

/** Counted days in a row: from today if today counts, from yesterday otherwise; 0 when yesterday did not count. */
export function streak(days: ReadonlyMap<Day, DayLog>, today: Day): number {
  let day = isCounted(days.get(today)) ? today : addDays(today, -1)
  let count = 0
  while (isCounted(days.get(day))) {
    count += 1
    day = addDays(day, -1)
  }
  return count
}

/** "Seri başladı", "5 gün üst üste", or nothing before a streak starts. */
export const streakText = (count: number): string | undefined => (count === 0 ? undefined : count === 1 ? 'Seri başladı' : `${count} gün üst üste`)

/** The last seven days, today last, each done or not. */
export const lastWeek = (days: ReadonlyMap<Day, DayLog>, today: Day): { day: Day; done: boolean }[] =>
  lastDays(today, 7).map((day) => ({ day, done: isCounted(days.get(day)) }))

export type TodayStatus = 'start' | 'continue' | 'done'

/** What the day's card offers on Bugün: a repeat day says "Başla" until the day counts. */
export function todayStatus(log: DayLog, progress: ReadonlyMap<string, CardProgress>): TodayStatus {
  if (!log.dailyCardId) return 'start'
  if (log.countedCardIds.includes(log.dailyCardId)) return 'done'
  if (log.repeat) return 'start'
  return progress.has(log.dailyCardId) ? 'continue' : 'start'
}
