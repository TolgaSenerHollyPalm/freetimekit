import { describe, expect, it } from 'vitest'
import { opened } from '../cards/test-helpers.ts'
import type { TableSession } from '../cards/types.ts'
import { href, parseRoute, redirect, type Route, type RouteState } from './router.ts'

describe('routes', () => {
  it.each<Route>([
    { screen: 'home' },
    { screen: 'welcome' },
    { screen: 'settings' },
    { screen: 'topics' },
    { screen: 'weekend' },
    { screen: 'card', cardId: 'tarih-001' },
    { screen: 'quiz', cardId: 'tarih-001' },
    { screen: 'done', cardId: 'tarih-001' },
    { screen: 'answers', cardId: 'tarih-001' },
    { screen: 'table-new' },
    { screen: 'table' },
    { screen: 'table-done' },
  ])('survive a round trip through the URL: %o', (route) => {
    expect(parseRoute(href(route))).toEqual(route)
  })

  it('falls back to the home screen for unknown addresses', () => {
    expect(parseRoute('')).toEqual({ screen: 'home' })
    expect(parseRoute('#/nowhere')).toEqual({ screen: 'home' })
    expect(parseRoute('#/card')).toEqual({ screen: 'home' })
    expect(parseRoute('#/card/%E0%A4%A')).toEqual({ screen: 'home' })
  })
})

describe('addresses that do not fit the data', () => {
  const card = 'tarih-001'
  const state = (over: Partial<RouteState> = {}): RouteState => ({ hasSettings: true, progress: new Map(), ...over })
  const with_ = (...records: ReturnType<typeof opened>[]) => new Map(records.map((p) => [p.cardId, p]))
  const table = (finished = false) => ({ id: 't', ...(finished && { finishedAt: 'x' }) }) as TableSession

  it('send everything to the welcome until there are interests, and the welcome home after', () => {
    expect(redirect({ screen: 'home' }, state({ hasSettings: false }))).toEqual({ screen: 'welcome' })
    expect(redirect({ screen: 'settings' }, state({ hasSettings: false }))).toBeUndefined()
    expect(redirect({ screen: 'welcome' }, state())).toEqual({ screen: 'home' })
  })

  it('send an unfinished card’s day end to its questions, or to the card when it was never opened', () => {
    expect(redirect({ screen: 'done', cardId: card }, state())).toEqual({ screen: 'card', cardId: card })
    expect(redirect({ screen: 'done', cardId: card }, state({ progress: with_(opened(card, '2026-09-30')) }))).toEqual({ screen: 'quiz', cardId: card })
    expect(redirect({ screen: 'done', cardId: card }, state({ progress: with_(opened(card, '2026-09-30', true)) }))).toBeUndefined()
  })

  it('send the answers of a card with none to the card', () => {
    expect(redirect({ screen: 'answers', cardId: card }, state({ progress: with_(opened(card, '2026-09-30')) }))).toEqual({ screen: 'card', cardId: card })
    expect(redirect({ screen: 'answers', cardId: card }, state({ progress: with_({ ...opened(card, '2026-09-30'), answers: { q: 1 } }) }))).toBeUndefined()
  })

  it('send the table to the list when there is none, and its end home when the table is not finished', () => {
    expect(redirect({ screen: 'table' }, state())).toEqual({ screen: 'weekend' })
    expect(redirect({ screen: 'table' }, state({ table: table() }))).toBeUndefined()
    expect(redirect({ screen: 'table' }, state({ table: table(true) }))).toEqual({ screen: 'table-done' })
    expect(redirect({ screen: 'table-done' }, state({ table: table() }))).toEqual({ screen: 'home' })
    expect(redirect({ screen: 'table-done' }, state({ table: table(true) }))).toBeUndefined()
  })
})
