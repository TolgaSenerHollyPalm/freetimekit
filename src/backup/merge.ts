import { mergeById } from 'kitshelf-ui/backup/merge.ts'
import type { CardProgress, DayLog, Settings, WeekendItem } from '../cards/types.ts'

const earlier = (a?: string, b?: string) => (!a ? b : !b ? a : a < b ? a : b)
const later = (a: string, b: string) => (a > b ? a : b)

/**
 * One card's progress from two devices, field by field, so a finished card never comes back unfinished: the
 * earlier opening and finishing, every answer either side has, the finished side's answer where both have one.
 */
export function mergeOne(local: CardProgress, incoming: CardProgress): CardProgress {
  const finished = local.completedAt ? 'local' : incoming.completedAt ? 'incoming' : 'local'
  const answers = { ...incoming.answers, ...local.answers }
  if (finished === 'incoming') Object.assign(answers, incoming.answers)
  const completedAt = earlier(local.completedAt, incoming.completedAt)
  return {
    cardId: local.cardId,
    openedAt: earlier(local.openedAt, incoming.openedAt)!,
    answers,
    ...(completedAt && { completedAt }),
    updatedAt: later(local.updatedAt, incoming.updatedAt),
  }
}

export interface Merged<T> {
  items: T[]
  added: number
  updated: number // records whose merged copy differs from the device's
}

// Field by field: records written by different code paths keep their keys in different orders.
const sameAnswers = (a: Record<string, number>, b: Record<string, number>) => Object.keys(a).length === Object.keys(b).length && Object.keys(a).every((id) => a[id] === b[id])
const sameProgress = (a: CardProgress, b: CardProgress) => a.openedAt === b.openedAt && a.completedAt === b.completedAt && a.updatedAt === b.updatedAt && sameAnswers(a.answers, b.answers)
const sameSettings = (a: Settings, b: Settings) => a.updatedAt === b.updatedAt && a.interests.join() === b.interests.join()

export function mergeProgress(local: readonly CardProgress[], incoming: readonly CardProgress[]): Merged<CardProgress> {
  const byId = new Map(local.map((p) => [p.cardId, p]))
  let added = 0
  let updated = 0
  for (const theirs of incoming) {
    const mine = byId.get(theirs.cardId)
    if (!mine) {
      byId.set(theirs.cardId, theirs)
      added += 1
      continue
    }
    const merged = mergeOne(mine, theirs)
    if (sameProgress(merged, mine)) continue
    byId.set(theirs.cardId, merged)
    updated += 1
  }
  return { items: [...byId.values()], added, updated }
}

/** Days by date: the counted cards of both, and the device's own choice of card and suggestions where it has one. */
export function mergeDays(local: readonly DayLog[], incoming: readonly DayLog[]): Merged<DayLog> {
  const byDate = new Map(local.map((day) => [day.date, day]))
  let added = 0
  let updated = 0
  for (const theirs of incoming) {
    const mine = byDate.get(theirs.date)
    if (!mine) {
      byDate.set(theirs.date, theirs)
      added += 1
      continue
    }
    const counted = [...mine.countedCardIds, ...theirs.countedCardIds.filter((id) => !mine.countedCardIds.includes(id))]
    // A day the device opened before any card was on it takes the backup's card, which may be under way.
    const choice = !mine.dailyCardId && theirs.dailyCardId ? { dailyCardId: theirs.dailyCardId, repeat: theirs.repeat, suggestedCardIds: theirs.suggestedCardIds } : undefined
    if (counted.length === mine.countedCardIds.length && !choice) continue
    byDate.set(theirs.date, { ...mine, ...choice, countedCardIds: counted, updatedAt: later(mine.updatedAt, theirs.updatedAt) })
    updated += 1
  }
  return { items: [...byDate.values()], added, updated }
}

export function mergeWeekend(local: readonly WeekendItem[], incoming: readonly WeekendItem[]): Merged<WeekendItem> {
  const result = mergeById(local, incoming)
  return { items: result.items, added: result.added, updated: result.updated }
}

/** The newer settings; the welcome's, which carry no stamp, count as the oldest. */
export function mergeSettings(local: Settings | undefined, incoming: Settings | undefined): { settings?: Settings; changed: boolean } {
  if (!incoming) return { settings: local, changed: false }
  if (!local) return { settings: incoming, changed: true }
  const take = local.updatedAt === undefined ? incoming.updatedAt !== undefined || !sameSettings(local, incoming) : (incoming.updatedAt ?? '') > local.updatedAt
  return take ? { settings: incoming, changed: !sameSettings(local, incoming) } : { settings: local, changed: false }
}
