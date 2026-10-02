import type { Card } from '../packs/types.ts'

/** A local calendar day, YYYY-MM-DD. */
export type Day = string

export interface Settings {
  interests: string[] // category ids, at least one
  updatedAt?: string // absent while only the first-run welcome wrote it, so a backup's settings win a merge
}

export interface CardProgress {
  cardId: string
  openedAt: string // ISO, when the card was first opened
  answers: Record<string, number> // question id → chosen option; stays tied to the question through pack updates
  completedAt?: string // once every question of the card was answered; written once, never removed
  updatedAt: string
}

export interface DayLog {
  date: Day
  dailyCardId?: string // the day's card; none while no card was on the device
  repeat: boolean // the day's card is one seen before, since no new card was left
  suggestedCardIds: string[] // the day's "Senin için seçtik"
  countedCardIds: string[] // what made the day count: cards finished that day, and the repeat day's card once opened
  updatedAt: string
}

export interface WeekendItem {
  id: string
  kind: 'card' | 'own'
  cardId?: string // kind 'card'
  title: string // own: 1–60 characters; card: a copy of the card's title when it was added
  category?: string // kind 'card': a copy of the card's category
  questions?: string[] // kind 'own': 1–3 discussion questions, each 1–200 characters
  addedAt: string
  updatedAt: string
}

export interface Player {
  id: string
  name: string
}

export interface TableTopic {
  id: string // the weekend item's id
  title: string
  category?: string
  questions: Card['questions'] // none for an own topic
  discussion: string[]
}

export type TableStep =
  | { kind: 'quiz'; topicId: string; questionId: string; playerId: string }
  | { kind: 'discussion'; topicId: string; index: number }

export interface TableAnswer {
  playerId: string
  choice: number
  correct: boolean
}

/** The one table in play; copied from the list when it starts, so later changes elsewhere never touch it. */
export interface TableSession {
  id: string
  startedAt: string
  players: Player[] // 2–8, in seating order
  topics: TableTopic[]
  steps: TableStep[]
  position: number // the current step
  answers: Record<string, TableAnswer> // by question id
  notes: Record<string, string> // by `${topicId}:${discussion index}`
  finishedAt?: string
}
