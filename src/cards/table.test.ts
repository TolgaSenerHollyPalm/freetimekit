import { describe, expect, it } from 'vitest'
import { answerStep, buildSteps, clock, initial, nextLabel, notesByTopic, playerProblems, sameName, standings, startTable, stepLabel, tableTopics, tablePoints } from './table.ts'
import { card } from './test-helpers.ts'
import type { TableSession, WeekendItem } from './types.ts'
import { hasCard, ownTopic, removeItem, toggleCard, topicProblems } from './weekend.ts'

const now = new Date('2026-10-03T15:00:00Z')
let next = 0
const ids = () => `id${++next}`

describe('the weekend list', () => {
  const gobekli = card('tarih-001', { title: 'Göbeklitepe' })

  it('adds a card once, with a copy of its title and category; adding it again takes it off', () => {
    const list = toggleCard([], gobekli, now, 'w1')
    expect(list).toEqual([{ id: 'w1', kind: 'card', cardId: 'tarih-001', title: 'Göbeklitepe', category: 'tarih', addedAt: now.toISOString(), updatedAt: now.toISOString() }])
    expect(hasCard(list, 'tarih-001')).toBe(true)
    expect(toggleCard(list, gobekli, now)).toEqual([])
  })

  it('keeps an own topic’s typed text, without empty question lines', () => {
    expect(topicProblems('  ', ['', ' '])).toEqual({ title: 'Konuyu yaz.', questions: 'En az bir soru yaz.' })
    expect(topicProblems('Oyunlar', ['', 'Hangi oyun?'])).toEqual({})
    expect(ownTopic(' Oyunlar ', ['', ' Hangi oyun? ', ''], now, 'o1')).toMatchObject({ id: 'o1', kind: 'own', title: 'Oyunlar', questions: ['Hangi oyun?'] })
  })

  it('puts a removed row back where it was', () => {
    const list = [ownTopic('A', ['?'], now, 'a'), ownTopic('B', ['?'], now, 'b'), ownTopic('C', ['?'], now, 'c')]
    const { list: without, undo } = removeItem(list, 'b')
    expect(without.map((i) => i.id)).toEqual(['a', 'c'])
    expect(undo(without).map((i) => i.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('players', () => {
  it('compare names the Turkish way', () => {
    expect(sameName('İsmail', 'ismail')).toBe(true)
    expect(sameName(' Işık', 'ışık ')).toBe(true)
    expect(sameName('ISMAIL', 'ismail')).toBe(false)
    expect(initial('ilker')).toBe('İ')
  })

  it('need a name each, no name twice, and at least two of them', () => {
    expect(playerProblems(['Ayşe', ' ', 'ayşe'])).toEqual({ fields: [undefined, 'Oyuncunun adını yaz.', 'Bu ad zaten var.'] })
    expect(playerProblems(['Ayşe'])).toEqual({ fields: [undefined], list: 'En az iki oyuncu gerekiyor.' })
  })
})

describe('the table', () => {
  const a = card('tarih-001', { title: 'Göbeklitepe', questions: 3, answers: [2, 0, 2] })
  const b = card('bilim-001', { title: 'Ahtapot', questions: 2 })
  const list: WeekendItem[] = [
    { id: 'w1', kind: 'card', cardId: 'tarih-001', title: 'Göbeklitepe', category: 'tarih', addedAt: '', updatedAt: '' },
    { id: 'w2', kind: 'card', cardId: 'doga-009', title: 'Gone', category: 'doga', addedAt: '', updatedAt: '' },
    { id: 'w3', kind: 'own', title: 'Telefonsuz bir gün', questions: ['Ne yapardın?'], addedAt: '', updatedAt: '' },
    { id: 'w4', kind: 'card', cardId: 'bilim-001', title: 'Ahtapot', category: 'bilim', addedAt: '', updatedAt: '' },
  ]
  const cards = new Map([a, b].map((c) => [c.id, c]))

  it('copies the list’s topics in order and skips cards that are not on the device', () => {
    const { topics, skipped } = tableTopics(list, cards)
    expect(skipped).toBe(1)
    expect(topics.map((t) => [t.id, t.title, t.questions.length, t.discussion.length])).toEqual([
      ['w1', 'Göbeklitepe', 3, 2],
      ['w3', 'Telefonsuz bir gün', 0, 1],
      ['w4', 'Ahtapot', 2, 2],
    ])
  })

  it('asks each topic’s quiz questions round the table, the turn carrying on across topics, then its discussion', () => {
    const { topics } = tableTopics(list, cards)
    const players = [{ id: 'p1', name: 'Ayşe' }, { id: 'p2', name: 'Mert' }]
    const steps = buildSteps(topics, players)
    expect(steps.map((s) => (s.kind === 'quiz' ? `${s.questionId}>${s.playerId}` : `${s.topicId}:${s.index}`))).toEqual([
      'tarih-001-q1>p1',
      'tarih-001-q2>p2',
      'tarih-001-q3>p1',
      'w1:0',
      'w1:1',
      'w3:0',
      'bilim-001-q1>p2',
      'bilim-001-q2>p1',
      'w4:0',
      'w4:1',
    ])
  })

  it('gives one point for a right answer and ranks ties together (1, 1, 3)', () => {
    const { topics } = tableTopics(list, cards)
    let session: TableSession = startTable(['Ayşe', 'Mert', 'Deniz'], topics, now, ids)
    const [p1, p2, p3] = session.players.map((p) => p.id)
    const play = (choice: number) => {
      session = answerStep(session, choice)
      session = { ...session, position: session.position + 1 }
    }
    expect(stepLabel(session)).toBe('Bilgi · 1 / 3')
    play(2) // Ayşe, right
    play(1) // Mert, wrong
    expect(nextLabel(session)).toBe('Sonraki soru')
    play(2) // Deniz, right
    expect(stepLabel(session)).toBe('Tartışma · 1 / 2')
    expect(tablePoints(session)).toEqual({ [p1]: 1, [p2]: 0, [p3]: 1 })
    expect(standings(session).map((row) => `${row.rank}. ${row.player.name} ${row.points}`)).toEqual(['1. Ayşe 1', '1. Deniz 1', '3. Mert 0'])
    session = { ...session, position: 4 }
    expect(nextLabel(session)).toBe('Sonraki konu: Telefonsuz bir gün')
    session = { ...session, position: session.steps.length - 1 }
    expect(nextLabel(session)).toBe('Masayı bitir')
  })

  it('does not take a second answer, and collects the notes topic by topic', () => {
    const { topics } = tableTopics(list, cards)
    let session = startTable(['Ayşe', 'Mert'], topics, now, ids)
    session = answerStep(answerStep(session, 2), 0)
    expect(Object.values(session.answers)).toEqual([{ playerId: session.players[0].id, choice: 2, correct: true }])
    session = { ...session, notes: { 'w1:1': ' Şölen için. ', 'w3:0': '' } }
    expect(notesByTopic(session)).toEqual([{ topic: topics[0], notes: [{ question: 'Peki sen?', text: 'Şölen için.' }] }])
  })

  it('shows the timer as the design does', () => {
    expect([180, 65, 7, 0].map(clock)).toEqual(['03:00', '01:05', '00:07', '00:00'])
  })
})
