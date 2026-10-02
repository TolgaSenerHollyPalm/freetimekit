import { cardCategory, DIFFICULTIES, LIMITS, type Pack, type PackIndex } from './types.ts'

export type Check<T> = { ok: true; value: T } | { ok: false; errors: string[] }

type JsonObject = Record<string, unknown>

const isObject = (value: unknown): value is JsonObject => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string' && value.trim() !== ''
const isWhole = (value: unknown, min: number): value is number => typeof value === 'number' && Number.isInteger(value) && value >= min
const ID = /^[a-z0-9][a-z0-9-]*$/
const COLOR = /^#[0-9A-Fa-f]{6}$/
// A plain file name inside packs/, so an entry can never point outside that folder.
export const SAFE_FILE = /^[A-Za-z0-9][A-Za-z0-9._-]*\.json$/

export function isDay(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value)
}

/** Whether the data says it was written for a newer app, so the answer is "update" rather than "broken". */
export const newerSchema = (data: unknown): boolean => isObject(data) && typeof data.schemaVersion === 'number' && data.schemaVersion > 1

/** Checks packs/index.json: every category and pack entry, so a broken one is never half used. */
export function validateIndex(data: unknown): Check<PackIndex> {
  if (!isObject(data)) return { ok: false, errors: ['The index is not a JSON object.'] }
  const errors: string[] = []
  if (data.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (data.kit !== 'freetimekit') errors.push('kit must be "freetimekit".')
  if (!isDay(data.updatedAt)) errors.push('updatedAt must be a YYYY-MM-DD date.')
  const categories = new Set<string>()
  if (!Array.isArray(data.categories) || data.categories.length === 0) errors.push('categories must list at least one category.')
  else
    data.categories.forEach((entry: unknown, i) => {
      const at = `categories[${i}]`
      if (!isObject(entry) || !isText(entry.id) || !ID.test(entry.id)) return void errors.push(`${at}: id must be lower case letters, digits and dashes.`)
      if (categories.has(entry.id)) errors.push(`${at}: "${entry.id}" is listed twice.`)
      categories.add(entry.id)
      if (!isText(entry.label) || !isText(entry.description)) errors.push(`${at}: label and description are required.`)
      if (typeof entry.color !== 'string' || !COLOR.test(entry.color)) errors.push(`${at}: color must be #RRGGBB.`)
    })
  const packIds = new Set<string>()
  if (!Array.isArray(data.packs)) errors.push('packs must be a list.')
  else
    data.packs.forEach((entry: unknown, i) => {
      const at = `packs[${i}]`
      if (!isObject(entry) || !isText(entry.id)) return void errors.push(`${at}: id is required.`)
      if (packIds.has(entry.id)) errors.push(`${at}: "${entry.id}" is listed twice.`)
      packIds.add(entry.id)
      if (typeof entry.category !== 'string' || !categories.has(entry.category)) errors.push(`${at}: category is not one of the index's.`)
      if (!isWhole(entry.version, 1) || !isWhole(entry.cards, 1)) errors.push(`${at}: version and cards must be whole numbers from 1.`)
      if (typeof entry.file !== 'string' || !SAFE_FILE.test(entry.file) || entry.file === 'index.json') errors.push(`${at}: file must be a plain .json name inside packs/.`)
    })
  return errors.length ? { ok: false, errors } : { ok: true, value: data as unknown as PackIndex }
}

const inRange = (list: unknown, [min, max]: readonly [number, number]) => Array.isArray(list) && list.length >= min && list.length <= max

/** Checks one pack against the schema and the index's categories, listing every problem at once. */
export function validatePack(data: unknown, categories: ReadonlySet<string>): Check<Pack> {
  if (!isObject(data)) return { ok: false, errors: ['The pack is not a JSON object.'] }
  const errors: string[] = []
  if (data.schemaVersion !== 1) errors.push('schemaVersion must be 1.')
  if (data.kit !== 'freetimekit') errors.push('kit must be "freetimekit".')
  if (!isText(data.id) || !isText(data.title)) errors.push('id and title are required.')
  if (typeof data.category !== 'string' || !categories.has(data.category)) errors.push('category is not one of the index\'s.')
  if (!isWhole(data.version, 1)) errors.push('version must be a whole number from 1.')
  if (!isDay(data.updatedAt)) errors.push('updatedAt must be a YYYY-MM-DD date.')
  if (!Array.isArray(data.cards) || data.cards.length === 0) return { ok: false, errors: [...errors, 'cards must list at least one card.'] }

  const ids = new Set<string>()
  const unique = (id: unknown, at: string) => {
    if (!isText(id)) return void errors.push(`${at}: id is required.`)
    if (ids.has(id)) errors.push(`${at}: id "${id}" is used twice.`)
    ids.add(id)
  }
  data.cards.forEach((card: unknown, i) => {
    const at = `cards[${i}]`
    if (!isObject(card)) return void errors.push(`${at}: not an object.`)
    unique(card.id, at)
    if (typeof card.id === 'string' && cardCategory(card.id) !== data.category) errors.push(`${at}: id "${card.id}" does not start with the pack's category.`)
    if (!isText(card.title) || !isText(card.subtitle)) errors.push(`${at}: title and subtitle are required.`)
    if (!inRange(card.facts, LIMITS.facts) || !(card.facts as unknown[]).every(isText)) errors.push(`${at}: facts must be ${LIMITS.facts.join('–')} texts.`)
    if (!inRange(card.discussion, LIMITS.discussion) || !(card.discussion as unknown[]).every(isText)) errors.push(`${at}: discussion must be ${LIMITS.discussion.join('–')} texts.`)
    if (!inRange(card.sources, LIMITS.sources) || !(card.sources as unknown[]).every((s) => isObject(s) && isText(s.name) && typeof s.url === 'string' && /^https?:\/\/\S+$/.test(s.url))) {
      errors.push(`${at}: sources must be ${LIMITS.sources.join('–')} names with http(s) addresses.`)
    }
    if (!inRange(card.questions, LIMITS.questions)) return void errors.push(`${at}: questions must be ${LIMITS.questions.join('–')}.`)
    ;(card.questions as unknown[]).forEach((question, j) => {
      const where = `${at}.questions[${j}]`
      if (!isObject(question)) return void errors.push(`${where}: not an object.`)
      unique(question.id, where)
      if (!isText(question.text) || !isText(question.explanation)) errors.push(`${where}: text and explanation are required.`)
      const options = question.options
      if (!Array.isArray(options) || options.length !== 4 || !options.every(isText) || new Set(options.map((o: string) => o.trim().toLocaleLowerCase('tr-TR'))).size !== 4) {
        errors.push(`${where}: options must be 4 different texts.`)
      }
      if (!isWhole(question.answerIndex, 0) || question.answerIndex > 3) errors.push(`${where}: answerIndex must be 0–3.`)
      if (!DIFFICULTIES.includes(question.difficulty as never)) errors.push(`${where}: difficulty must be easy, medium or hard.`)
    })
  })
  return errors.length ? { ok: false, errors } : { ok: true, value: data as unknown as Pack }
}

/** Card ids another pack on the device already uses: a pack bringing one of them is refused. */
export function clashingCardIds(pack: Pack, others: readonly Pack[]): string[] {
  const taken = new Set(others.filter((other) => other.id !== pack.id).flatMap((other) => other.cards.map((card) => card.id)))
  return pack.cards.map((card) => card.id).filter((id) => taken.has(id))
}
