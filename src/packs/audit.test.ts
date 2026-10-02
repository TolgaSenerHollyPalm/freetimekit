import { describe, expect, it } from 'vitest'
import type { Pack, PackIndex } from './types.ts'
import { validateIndex, validatePack } from './validate.ts'

// Every file the site will serve from packs/, read the way the app reads it (plan 4.3).
const all = import.meta.glob<unknown>('../../public/packs/*.json', { eager: true, import: 'default' })
const byName = Object.fromEntries(Object.entries(all).map(([path, data]) => [path.replace(/^.*\//, ''), data]))
const files = Object.keys(byName).filter((file) => file !== 'index.json')
const indexCheck = validateIndex(byName['index.json'])
const index = indexCheck.ok ? indexCheck.value : undefined
const categories = new Set(index?.categories.map((c) => c.id))
const packs = files.map((file) => ({ file, check: validatePack(byName[file], categories) }))
const valid = packs.flatMap(({ file, check }) => (check.ok ? [{ file, pack: check.value }] : []))

/** Every text a reader sees: card fields, sources' names, questions, options and explanations. */
function texts(pack: Pack): string[] {
  return pack.cards.flatMap((card) => [
    card.title,
    card.subtitle,
    ...card.facts,
    ...card.discussion,
    ...card.sources.map((source) => source.name),
    ...card.questions.flatMap((q) => [q.text, q.explanation, ...q.options]),
  ])
}

describe('the published packs', () => {
  it('have a valid index', () => {
    expect(indexCheck.ok ? [] : indexCheck.errors).toEqual([])
  })

  it.each(files)('%s passes the app’s own checks', (file) => {
    const check = packs.find((p) => p.file === file)!.check
    expect(check.ok ? [] : check.errors).toEqual([])
  })

  it('use every card and question id once, across all packs', () => {
    const ids = valid.flatMap(({ pack }) => pack.cards.flatMap((card) => [card.id, ...card.questions.map((q) => q.id)]))
    expect(ids.length - new Set(ids).size).toBe(0)
  })

  it('are all listed in the index, with the same card count and version, and every listed file is there', () => {
    const listed = (index as PackIndex).packs
    for (const { file, pack } of valid) expect(listed.find((entry) => entry.file === file), file).toMatchObject({ id: pack.id, category: pack.category, version: pack.version, cards: pack.cards.length })
    expect(listed.map((entry) => entry.file).sort()).toEqual([...files].sort())
  })

  it('write the typographic apostrophe, never a straight one (addresses aside)', () => {
    const straight = valid.flatMap(({ pack }) => texts(pack).filter((text) => text.includes("'")).map((text) => `${pack.id}: ${text}`))
    expect(straight).toEqual([])
  })

  it('spread the right answers over the four options: no option holds more than 40 per cent', () => {
    for (const { pack } of valid) {
      const answers = pack.cards.flatMap((card) => card.questions.map((q) => q.answerIndex))
      const share = [0, 1, 2, 3].map((option) => answers.filter((a) => a === option).length / answers.length)
      expect(Math.max(...share), `${pack.id}: ${share.map((s) => Math.round(s * 100)).join('/')}`).toBeLessThanOrEqual(0.4)
    }
  })
})
