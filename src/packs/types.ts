/** A category the packs belong to, as `index.json` lists it; its colour is the same in both schemes. */
export interface Category {
  id: string // 'tarih'
  label: string // 'Tarih'
  color: string // '#8A5A37', white text and icons on it
  description: string // 'Uygarlıklar, olaylar, yerler'
}

export interface IndexEntry {
  id: string // 'ftk-tarih-1'
  category: string
  version: number
  cards: number
  file: string // a plain file name inside packs/
}

/** packs/index.json: the categories and every pack, in the order the app shows and picks them. */
export interface PackIndex {
  schemaVersion: 1
  kit: 'freetimekit'
  updatedAt: string // YYYY-MM-DD
  categories: Category[]
  packs: IndexEntry[]
}

export const DIFFICULTIES = ['easy', 'medium', 'hard'] as const
export type Difficulty = (typeof DIFFICULTIES)[number]

export interface Question {
  id: string // 'tarih-001-q1'; answers stay tied to it through pack updates
  text: string
  options: string[] // exactly 4, all different
  answerIndex: number // 0–3
  explanation: string
  difficulty: Difficulty
}

export interface Source {
  name: string
  url: string
}

export interface Card {
  id: string // 'tarih-001': unique across every pack and never changed; the part before the number is its category
  title: string
  subtitle: string
  facts: string[] // 3–4
  sources: Source[] // 1–3
  questions: Question[] // 3–5
  discussion: string[] // 2–3
}

export interface Pack {
  schemaVersion: 1
  id: string // 'ftk-tarih-1'
  kit: 'freetimekit'
  category: string // a category of the index
  title: string // 'Tarih · Paket 1'
  version: number
  updatedAt: string // YYYY-MM-DD
  cards: Card[]
}

/** How many of each a card has: the plan's ranges (4.1). */
export const LIMITS = {
  facts: [3, 4],
  sources: [1, 3],
  questions: [3, 5],
  discussion: [2, 3],
} as const

/** The category a card belongs to, read from its id: 'tarih-001' → 'tarih'. */
export const cardCategory = (cardId: string): string => cardId.replace(/-\d+$/, '')
