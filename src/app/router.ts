import { go, useHash } from 'kitshelf-ui/app/hashRouter.ts'
import type { CardProgress, TableSession } from '../cards/types.ts'

// Routes live in the URL hash, so GitHub Pages only ever serves index.html.
export type Route =
  | { screen: 'home' }
  | { screen: 'welcome' }
  | { screen: 'settings' }
  | { screen: 'topics' }
  | { screen: 'weekend' }
  | { screen: 'card'; cardId: string }
  | { screen: 'quiz'; cardId: string }
  | { screen: 'done'; cardId: string }
  | { screen: 'answers'; cardId: string }
  | { screen: 'table-new' }
  | { screen: 'table' }
  | { screen: 'table-done' }

export function href(route: Route): string {
  switch (route.screen) {
    case 'home':
      return '#/'
    case 'welcome':
      return '#/welcome'
    case 'settings':
      return '#/settings'
    case 'topics':
      return '#/topics'
    case 'weekend':
      return '#/weekend'
    case 'card':
      return `#/card/${encodeURIComponent(route.cardId)}`
    case 'quiz':
      return `#/card/${encodeURIComponent(route.cardId)}/quiz`
    case 'done':
      return `#/card/${encodeURIComponent(route.cardId)}/done`
    case 'answers':
      return `#/card/${encodeURIComponent(route.cardId)}/answers`
    case 'table-new':
      return '#/table/new'
    case 'table':
      return '#/table'
    case 'table-done':
      return '#/table/done'
  }
}

const CARD_PARTS = { quiz: 'quiz', done: 'done', answers: 'answers' } as const

export function parseRoute(hash: string): Route {
  let parts: string[]
  try {
    parts = hash.replace(/^#/, '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
  } catch {
    return { screen: 'home' }
  }
  const [section, a, b] = parts
  switch (section) {
    case 'welcome':
    case 'settings':
    case 'topics':
    case 'weekend':
      return { screen: section }
    case 'card':
      if (!a) return { screen: 'home' }
      if (b === undefined) return { screen: 'card', cardId: a }
      return b in CARD_PARTS ? { screen: CARD_PARTS[b as keyof typeof CARD_PARTS], cardId: a } : { screen: 'card', cardId: a }
    case 'table':
      return a === 'new' ? { screen: 'table-new' } : a === 'done' ? { screen: 'table-done' } : { screen: 'table' }
    default:
      return { screen: 'home' }
  }
}

/** Goes to a route. `replace` swaps the current history entry, so the back button skips it. */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  go(href(route), options)
}

export function useRoute(): Route {
  return parseRoute(useHash())
}

export interface RouteState {
  hasSettings: boolean
  progress: ReadonlyMap<string, CardProgress>
  table?: TableSession
}

/** Where an address that does not fit the data goes instead (plan 6), or undefined when it fits. */
export function redirect(route: Route, state: RouteState): Route | undefined {
  if (!state.hasSettings) return route.screen === 'welcome' || route.screen === 'settings' ? undefined : { screen: 'welcome' }
  const progress = 'cardId' in route ? state.progress.get(route.cardId) : undefined
  switch (route.screen) {
    case 'welcome':
      return { screen: 'home' }
    case 'done':
      return progress?.completedAt ? undefined : progress ? { screen: 'quiz', cardId: route.cardId } : { screen: 'card', cardId: route.cardId }
    case 'answers':
      return progress && Object.keys(progress.answers).length > 0 ? undefined : { screen: 'card', cardId: route.cardId }
    case 'table':
      return !state.table ? { screen: 'weekend' } : state.table.finishedAt ? { screen: 'table-done' } : undefined
    case 'table-done':
      return state.table?.finishedAt ? undefined : { screen: 'home' }
    default:
      return undefined
  }
}
