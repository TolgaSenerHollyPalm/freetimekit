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

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

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
    if (!same(merged, mine)) updated += 1
    byId.set(theirs.cardId, merged)
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
    if (counted.length === mine.countedCardIds.length) continue
    byDate.set(theirs.date, { ...mine, countedCardIds: counted, updatedAt: later(mine.updatedAt, theirs.updatedAt) })
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
  const take = local.updatedAt === undefined ? incoming.updatedAt !== undefined || !same(local, incoming) : (incoming.updatedAt ?? '') > local.updatedAt
  return take ? { settings: incoming, changed: !same(local, incoming) } : { settings: local, changed: false }
}
