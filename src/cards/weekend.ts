import { cardCategory, type Card } from '../packs/types.ts'
import type { WeekendItem } from './types.ts'

export const TITLE_MAX = 60
export const QUESTION_MAX = 200
export const OWN_QUESTIONS_MAX = 3

export const hasCard = (list: readonly WeekendItem[], cardId: string): boolean => list.some((item) => item.cardId === cardId)

/** Adds the card with a copy of its title and category, or takes it off when it is on the list already. */
export function toggleCard(list: readonly WeekendItem[], card: Card, now: Date, id: string = crypto.randomUUID()): WeekendItem[] {
  if (hasCard(list, card.id)) return list.filter((item) => item.cardId !== card.id)
  const stamp = now.toISOString()
  return [...list, { id, kind: 'card', cardId: card.id, title: card.title, category: cardCategory(card.id), addedAt: stamp, updatedAt: stamp }]
}

/** An own topic's fields as typed: spaces trimmed, empty question lines left out. */
export function tidyTopic(title: string, questions: readonly string[]): { title: string; questions: string[] } {
  return { title: title.trim().slice(0, TITLE_MAX), questions: questions.map((q) => q.trim().slice(0, QUESTION_MAX)).filter(Boolean).slice(0, OWN_QUESTIONS_MAX) }
}

export function topicProblems(title: string, questions: readonly string[]): { title?: string; questions?: string } {
  const tidy = tidyTopic(title, questions)
  return { ...(tidy.title === '' && { title: 'Konuyu yaz.' }), ...(tidy.questions.length === 0 && { questions: 'En az bir soru yaz.' }) }
}

export function ownTopic(title: string, questions: readonly string[], now: Date, id: string = crypto.randomUUID()): WeekendItem {
  const stamp = now.toISOString()
  return { id, kind: 'own', ...tidyTopic(title, questions), addedAt: stamp, updatedAt: stamp }
}

export const editTopic = (item: WeekendItem, title: string, questions: readonly string[]): WeekendItem => ({ ...item, ...tidyTopic(title, questions) })

/** The list without the item, and how to put it back where it was. */
export function removeItem(list: readonly WeekendItem[], id: string): { list: WeekendItem[]; undo: (current: readonly WeekendItem[]) => WeekendItem[] } {
  const index = list.findIndex((item) => item.id === id)
  const removed = list[index]
  return {
    list: list.filter((item) => item.id !== id),
    undo: (current) => (index === -1 || current.some((item) => item.id === id) ? [...current] : [...current.slice(0, index), removed, ...current.slice(index)]),
  }
}

/** What a card topic's row says about its card when it cannot show the card's own counts (plan 4.2). */
export type CardState = 'ok' | 'gone' | 'not-downloaded'
