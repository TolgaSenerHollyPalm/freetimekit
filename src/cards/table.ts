import type { Card } from '../packs/types.ts'
import type { Player, TableSession, TableStep, TableTopic, WeekendItem } from './types.ts'

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 8
export const NAME_MAX = 16
export const TIMER_SECONDS = 180

export const tidyName = (name: string): string => name.trim().slice(0, NAME_MAX)

/** The same name, whatever the case, with Turkish letters compared the Turkish way (İ/i, I/ı). */
export const sameName = (a: string, b: string): boolean => tidyName(a).toLocaleLowerCase('tr-TR') === tidyName(b).toLocaleLowerCase('tr-TR')

export const initial = (name: string): string => tidyName(name).slice(0, 1).toLocaleUpperCase('tr-TR')

/** A problem per name field, and one for the whole list when it is too short. */
export function playerProblems(names: readonly string[]): { fields: (string | undefined)[]; list?: string } {
  const fields = names.map((name, i) => {
    if (tidyName(name) === '') return 'Oyuncunun adını yaz.'
    return names.slice(0, i).some((other) => tidyName(other) !== '' && sameName(other, name)) ? 'Bu ad zaten var.' : undefined
  })
  return { fields, ...(names.length < MIN_PLAYERS && { list: 'En az iki oyuncu gerekiyor.' }) }
}

/** The list's topics as the table copies them; a card topic whose card is not on the device is skipped. */
export function tableTopics(list: readonly WeekendItem[], cards: ReadonlyMap<string, Card>): { topics: TableTopic[]; skipped: number } {
  const topics: TableTopic[] = []
  let skipped = 0
  for (const item of list) {
    if (item.kind === 'own') {
      topics.push({ id: item.id, title: item.title, questions: [], discussion: item.questions ?? [] })
      continue
    }
    const card = item.cardId ? cards.get(item.cardId) : undefined
    if (!card) {
      skipped += 1
      continue
    }
    topics.push({ id: item.id, title: card.title, ...(item.category && { category: item.category }), questions: card.questions, discussion: card.discussion })
  }
  return { topics, skipped }
}

/** Each topic's quiz questions, one player after another round the table, then its discussion questions. */
export function buildSteps(topics: readonly TableTopic[], players: readonly Player[]): TableStep[] {
  const steps: TableStep[] = []
  let seat = 0
  for (const topic of topics) {
    for (const question of topic.questions) {
      steps.push({ kind: 'quiz', topicId: topic.id, questionId: question.id, playerId: players[seat % players.length].id })
      seat += 1
    }
    topic.discussion.forEach((_, index) => steps.push({ kind: 'discussion', topicId: topic.id, index }))
  }
  return steps
}

export function startTable(names: readonly string[], topics: readonly TableTopic[], now: Date, ids: () => string = () => crypto.randomUUID()): TableSession {
  const players = names.map((name) => ({ id: ids(), name: tidyName(name) }))
  return { id: ids(), startedAt: now.toISOString(), players, topics: [...topics], steps: buildSteps(topics, players), position: 0, answers: {}, notes: {} }
}

export const topicOf = (session: TableSession, topicId: string): TableTopic => session.topics.find((topic) => topic.id === topicId)!

/** The answer of the player whose turn it is; a question already answered stays as it was. */
export function answerStep(session: TableSession, choice: number): TableSession {
  const step = session.steps[session.position]
  if (step?.kind !== 'quiz' || session.answers[step.questionId]) return session
  const question = topicOf(session, step.topicId).questions.find((q) => q.id === step.questionId)!
  return { ...session, answers: { ...session.answers, [step.questionId]: { playerId: step.playerId, choice, correct: choice === question.answerIndex } } }
}

/** One point for each right answer; every player at the table appears, with 0 if need be. */
export function tablePoints(session: Pick<TableSession, 'players' | 'answers'>): Record<string, number> {
  const points: Record<string, number> = Object.fromEntries(session.players.map((player) => [player.id, 0]))
  for (const answer of Object.values(session.answers)) if (answer.correct) points[answer.playerId] = (points[answer.playerId] ?? 0) + 1
  return points
}

export interface Standing {
  player: Player
  points: number
  rank: number
}

/** Highest points first; tied players share a rank (1, 1, 3) and keep their seating order. */
export function standings(session: Pick<TableSession, 'players' | 'answers'>): Standing[] {
  const points = tablePoints(session)
  const rows = session.players.map((player) => ({ player, points: points[player.id] }))
  return [...rows].sort((a, b) => b.points - a.points).map((row) => ({ ...row, rank: 1 + rows.filter((other) => other.points > row.points).length }))
}

export const hasQuiz = (session: Pick<TableSession, 'steps'>): boolean => session.steps.some((step) => step.kind === 'quiz')

/** "Bilgi · 2 / 3" or "Tartışma · 1 / 2": where the step is within its topic. */
export function stepLabel(session: TableSession, position = session.position): string {
  const step = session.steps[position]
  const topic = topicOf(session, step.topicId)
  if (step.kind === 'quiz') return `Bilgi · ${topic.questions.findIndex((q) => q.id === step.questionId) + 1} / ${topic.questions.length}`
  return `Tartışma · ${step.index + 1} / ${topic.discussion.length}`
}

/** The fixed button's words: the next question, the next topic by name, or the end. */
export function nextLabel(session: TableSession): string {
  const next = session.steps[session.position + 1]
  if (!next) return 'Masayı bitir'
  const current = session.steps[session.position]
  return next.topicId !== current.topicId ? `Sonraki konu: ${topicOf(session, next.topicId).title}` : 'Sonraki soru'
}

export const noteKey = (topicId: string, index: number): string => `${topicId}:${index}`

/** The notes written at the table, topic by topic, in the table's order. */
export function notesByTopic(session: TableSession): { topic: TableTopic; notes: { question: string; text: string }[] }[] {
  return session.topics
    .map((topic) => ({
      topic,
      notes: topic.discussion.flatMap((question, index) => {
        const text = session.notes[noteKey(topic.id, index)]?.trim()
        return text ? [{ question, text }] : []
      }),
    }))
    .filter((entry) => entry.notes.length > 0)
}

/** What "Notları paylaş" sends: the ranking, then the notes. */
export function shareText(session: TableSession): string {
  const lines = ['Hafta sonu masası']
  if (hasQuiz(session)) {
    lines.push('', 'Sıralama')
    for (const row of standings(session)) lines.push(`${row.rank}. ${row.player.name} · ${row.points} puan`)
  }
  for (const { topic, notes } of notesByTopic(session)) {
    lines.push('', topic.title)
    for (const note of notes) lines.push(`${note.question}`, `— ${note.text}`)
  }
  return lines.join('\n')
}

/** "03:00", "00:07", as the table's timer shows it. */
export const clock = (seconds: number): string => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`
