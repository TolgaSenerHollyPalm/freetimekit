import { cardCategory, type Card, type Category, type Pack, type PackIndex } from '../packs/types.ts'

/** The cards on the device, in the order the plan picks them: category, then pack, then card (plan 5.2). */
export interface Library {
  categories: Category[] // the index's order
  byCategory: Map<string, Card[]> // downloaded cards only
  cards: Map<string, Card>
  packsByCategory: Map<string, Pack[]>
}

export function buildLibrary(index: PackIndex, packs: readonly Pack[]): Library {
  const order = new Map(index.packs.map((entry, i) => [entry.id, i]))
  // A pack the index no longer lists stays usable, after the listed ones of its category.
  const sorted = [...packs].sort((a, b) => (order.get(a.id) ?? Infinity) - (order.get(b.id) ?? Infinity) || a.id.localeCompare(b.id))
  const known = new Set(index.categories.map((category) => category.id))
  const byCategory = new Map<string, Card[]>()
  const packsByCategory = new Map<string, Pack[]>()
  const cards = new Map<string, Card>()
  for (const pack of sorted) {
    if (!known.has(pack.category)) continue
    packsByCategory.set(pack.category, [...(packsByCategory.get(pack.category) ?? []), pack])
    for (const card of pack.cards) {
      if (cards.has(card.id)) continue
      cards.set(card.id, card)
      byCategory.set(pack.category, [...(byCategory.get(pack.category) ?? []), card])
    }
  }
  return { categories: index.categories, byCategory, cards, packsByCategory }
}

export const categoryOf = (library: Pick<Library, 'categories'>, cardId: string): Category | undefined =>
  library.categories.find((category) => category.id === cardCategory(cardId))

/** A card is gone when its category's packs are on the device but none holds it; not yet downloaded is not gone. */
export const isGone = (library: Library, cardId: string): boolean =>
  !library.cards.has(cardId) && library.packsByCategory.has(cardCategory(cardId))

/** "4 bilgi · 3 soru · 2 tartışma" */
export const cardCounts = (card: Card): string => `${card.facts.length} bilgi · ${card.questions.length} soru · ${card.discussion.length} tartışma`
