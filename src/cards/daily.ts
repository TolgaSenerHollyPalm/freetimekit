import { cardCategory, type Card } from '../packs/types.ts'
import { isGone, type Library } from './library.ts'
import type { CardProgress, Day, DayLog } from './types.ts'

/** Everything the day's choice depends on (plan 5.2). */
export interface Choice {
  library: Library
  interests: readonly string[]
  progress: ReadonlyMap<string, CardProgress>
  days: readonly DayLog[] // every day on the device; only the ones before `today` steer the choice
  today: Day
}

const SUGGESTIONS = 3

/** The day each category last gave the day's card, before today. */
function lastDailyDays(days: readonly DayLog[], today: Day): Map<string, Day> {
  const last = new Map<string, Day>()
  for (const log of days) {
    if (log.date >= today || !log.dailyCardId) continue
    const category = cardCategory(log.dailyCardId)
    if ((last.get(category) ?? '') < log.date) last.set(category, log.date)
  }
  return last
}

/** Categories that never gave a day's card first, in their own order; then the longest without one. */
export function rotation(categories: readonly string[], days: readonly DayLog[], today: Day): string[] {
  const last = lastDailyDays(days, today)
  return [...categories].sort((a, b) => (last.get(a) ?? '').localeCompare(last.get(b) ?? ''))
}

const inOrder = (library: Library): Card[] => library.categories.flatMap((category) => library.byCategory.get(category.id) ?? [])

/** The day's card: unseen in an interest, unseen elsewhere, started but unfinished, or else a repeat. */
export function pickDaily(choice: Choice): { dailyCardId?: string; repeat: boolean } {
  const { library, progress, days, today } = choice
  if (library.cards.size === 0) return { repeat: false }
  const order = library.categories.map((category) => category.id)
  const isInterest = (id: string) => choice.interests.includes(cardCategory(id))
  const firstUnseen = (categories: string[]) => {
    for (const category of rotation(categories, days, today)) {
      const card = library.byCategory.get(category)?.find((c) => !progress.has(c.id))
      if (card) return card.id
    }
    return undefined
  }
  const unseen = firstUnseen(order.filter((id) => choice.interests.includes(id))) ?? firstUnseen(order.filter((id) => !choice.interests.includes(id)))
  if (unseen) return { dailyCardId: unseen, repeat: false }

  const cards = inOrder(library)
  const opened = (card: Card) => progress.get(card.id)!.openedAt
  const unfinished = cards
    .filter((card) => progress.has(card.id) && !progress.get(card.id)!.completedAt)
    .sort((a, b) => Number(!isInterest(a.id)) - Number(!isInterest(b.id)) || opened(a).localeCompare(opened(b)))
  if (unfinished.length > 0) return { dailyCardId: unfinished[0].id, repeat: false }

  // Every downloaded card is finished: the one longest away comes back, one never the day's card first.
  const lastDaily = new Map<string, Day>()
  for (const log of days) if (log.date < today && log.dailyCardId && (lastDaily.get(log.dailyCardId) ?? '') < log.date) lastDaily.set(log.dailyCardId, log.date)
  const interests = cards.filter((card) => isInterest(card.id))
  const pool = interests.length > 0 ? interests : cards
  const repeat = [...pool].sort((a, b) => (lastDaily.get(a.id) ?? '').localeCompare(lastDaily.get(b.id) ?? ''))[0]
  return { dailyCardId: repeat.id, repeat: true }
}

/**
 * "Senin için seçtik": up to three unseen cards besides the day's, one per interest in rotation order with the
 * day's category last, then second cards of the same, then other categories. `keep` are already on the list.
 */
export function pickSuggestions(choice: Choice, dailyCardId: string | undefined, keep: readonly string[] = []): string[] {
  const { library, progress, days, today } = choice
  const order = library.categories.map((category) => category.id)
  const dailyCategory = dailyCardId ? cardCategory(dailyCardId) : undefined
  const rotate = (categories: string[]) => {
    const turned = rotation(categories, days, today)
    return dailyCategory && turned.includes(dailyCategory) ? [...turned.filter((c) => c !== dailyCategory), dailyCategory] : turned
  }
  const picked = [...keep]
  const taken = (id: string) => id === dailyCardId || picked.includes(id) || progress.has(id)
  const roundRobin = (categories: string[]) => {
    for (let added = true; added && picked.length < SUGGESTIONS; ) {
      added = false
      for (const category of categories) {
        if (picked.length >= SUGGESTIONS) break
        const card = library.byCategory.get(category)?.find((c) => !taken(c.id))
        if (card) {
          picked.push(card.id)
          added = true
        }
      }
    }
  }
  roundRobin(rotate(order.filter((id) => choice.interests.includes(id))))
  roundRobin(rotate(order.filter((id) => !choice.interests.includes(id))))
  return picked.slice(keep.length)
}

/**
 * The day's record: chosen once when the day starts and kept, even if the interests change. Picked again only when
 * it was empty and cards have arrived, or its card left with a pack update; a short list is topped up.
 */
export function ensureDay(existing: DayLog | undefined, choice: Choice, now: Date): DayLog {
  const stamp = now.toISOString()
  if (!existing || (existing.dailyCardId === undefined && choice.library.cards.size > 0)) {
    const daily = pickDaily(choice)
    return {
      date: choice.today,
      ...(daily.dailyCardId && { dailyCardId: daily.dailyCardId }),
      repeat: daily.repeat,
      suggestedCardIds: pickSuggestions(choice, daily.dailyCardId),
      countedCardIds: existing?.countedCardIds ?? [],
      updatedAt: stamp,
    }
  }
  let log = existing
  if (log.dailyCardId !== undefined && isGone(choice.library, log.dailyCardId)) {
    const daily = pickDaily(choice)
    const { dailyCardId: _gone, ...rest } = log
    log = { ...rest, ...(daily.dailyCardId && { dailyCardId: daily.dailyCardId }), repeat: daily.repeat, updatedAt: stamp }
  }
  if (log.suggestedCardIds.length < SUGGESTIONS) {
    const more = pickSuggestions(choice, log.dailyCardId, log.suggestedCardIds)
    if (more.length > 0) log = { ...log, suggestedCardIds: [...log.suggestedCardIds, ...more], updatedAt: stamp }
  }
  return log
}
