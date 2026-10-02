import type { Card, Pack, PackIndex, Question } from '../packs/types.ts'
import { buildLibrary } from './library.ts'
import type { CardProgress, DayLog } from './types.ts'

export const at = (day: string, time = '10:00') => `${day}T${time}:00.000Z`

/** A card with `questions` quiz questions, the first option always right unless `answers` says otherwise. */
export function card(id: string, { title = `Kart ${id}`, questions = 3, answers }: { title?: string; questions?: number; answers?: number[] } = {}): Card {
  const qs: Question[] = Array.from({ length: questions }, (_, i) => ({
    id: `${id}-q${i + 1}`,
    text: `Soru ${i + 1}?`,
    options: ['A', 'B', 'C', 'D'],
    answerIndex: answers?.[i] ?? 0,
    explanation: 'Çünkü.',
    difficulty: 'easy',
  }))
  return {
    id,
    title,
    subtitle: 'Alt başlık',
    facts: ['Bir.', 'İki.', 'Üç.'],
    sources: [{ name: 'Kaynak', url: 'https://example.org/' }],
    questions: qs,
    discussion: ['Sence?', 'Peki sen?'],
  }
}

export const pack = (category: string, cards: Card[], n = 1, version = 1): Pack => ({
  schemaVersion: 1,
  id: `ftk-${category}-${n}`,
  kit: 'freetimekit',
  category,
  title: `${category} · Paket ${n}`,
  version,
  updatedAt: '2026-10-02',
  cards,
})

export const CATEGORIES = ['tarih', 'bilim', 'doga', 'sanat']

export function index(packs: Pack[], categories = CATEGORIES): PackIndex {
  return {
    schemaVersion: 1,
    kit: 'freetimekit',
    updatedAt: '2026-10-02',
    categories: categories.map((id) => ({ id, label: id.toUpperCase(), color: '#123456', description: `${id} açıklaması` })),
    packs: packs.map((p) => ({ id: p.id, category: p.category, version: p.version, cards: p.cards.length, file: `${p.id}.json` })),
  }
}

/** Three cards in each category: tarih-001…003, bilim-001…003, and so on. */
export function sampleLibrary(categories = CATEGORIES, perCategory = 3) {
  const packs = categories.map((category) => pack(category, Array.from({ length: perCategory }, (_, i) => card(`${category}-00${i + 1}`))))
  return { packs, index: index(packs, categories), library: buildLibrary(index(packs, categories), packs) }
}

export const opened = (cardId: string, day: string, completed = false): CardProgress => ({
  cardId,
  openedAt: at(day),
  answers: {},
  ...(completed && { completedAt: at(day, '11:00') }),
  updatedAt: at(day),
})

export const dayLog = (date: string, dailyCardId?: string, counted: string[] = [], extra: Partial<DayLog> = {}): DayLog => ({
  date,
  ...(dailyCardId && { dailyCardId }),
  repeat: false,
  suggestedCardIds: [],
  countedCardIds: counted,
  updatedAt: at(date),
  ...extra,
})
