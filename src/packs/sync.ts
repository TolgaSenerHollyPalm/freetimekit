import type { IndexEntry, Pack, PackIndex } from './types.ts'
import { clashingCardIds, newerSchema, validateIndex, validatePack } from './validate.ts'

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>

/** What syncing needs from the device's storage: the packs' versions and a way to save one. */
export interface PackStore {
  versions(): Promise<Map<string, number>>
  /** Saves the pack in its own transaction unless the device already has that version or a newer one. */
  saveIfNewer(pack: Pack): Promise<boolean>
}

export type Problem = 'timeout' | 'network' | 'not-found' | 'server' | 'web-page' | 'broken' | 'too-new' | 'invalid' | 'stale' | 'storage'

export const TIMEOUT_MS = 10_000

type Download = { ok: true; data: unknown } | { ok: false; problem: Problem }

/** Bytes read so far, and how many there are when the server says so (not for a compressed answer). */
export type Bytes = { loaded: number; total?: number }

async function readText(response: Response, onBytes?: (bytes: Bytes) => void): Promise<string> {
  if (!onBytes || !response.body) return response.text()
  const length = Number(response.headers.get('content-length'))
  const encoding = response.headers.get('content-encoding')
  // A gzip answer's length counts compressed bytes while the stream gives the unpacked ones.
  const total = length > 0 && (!encoding || encoding === 'identity') ? length : undefined
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    onBytes({ loaded, total })
  }
  const all = new Uint8Array(loaded)
  let at = 0
  for (const chunk of chunks) {
    all.set(chunk, at)
    at += chunk.byteLength
  }
  return new TextDecoder().decode(all)
}

/** A JSON file past the browser cache; the timeout also covers reading the body, so a stalled connection cannot hang. */
export async function download(fetcher: Fetcher, url: string, timeoutMs = TIMEOUT_MS, onBytes?: (bytes: Bytes) => void): Promise<Download> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetcher(url, { cache: 'no-store', signal: controller.signal })
    if (!response.ok) return { ok: false, problem: response.status === 404 ? 'not-found' : 'server' }
    const text = await readText(response, onBytes)
    try {
      return { ok: true, data: JSON.parse(text) }
    } catch {
      // A web page instead of JSON usually means a Wi-Fi login page.
      return { ok: false, problem: text.trimStart().startsWith('<') ? 'web-page' : 'broken' }
    }
  } catch {
    return { ok: false, problem: controller.signal.aborted ? 'timeout' : 'network' }
  } finally {
    clearTimeout(timer)
  }
}

export type IndexResult = { ok: true; index: PackIndex } | { ok: false; problem: Problem }

export async function fetchIndex(fetcher: Fetcher, baseUrl: string, timeoutMs = TIMEOUT_MS): Promise<IndexResult> {
  const file = await download(fetcher, `${baseUrl}packs/index.json`, timeoutMs)
  if (!file.ok) return file
  if (newerSchema(file.data)) return { ok: false, problem: 'too-new' }
  const check = validateIndex(file.data)
  if (!check.ok) {
    console.error('packs/index.json is invalid', check.errors)
    return { ok: false, problem: 'invalid' }
  }
  return { ok: true, index: check.value }
}

export type PackOutcome = { entry: IndexEntry; ok: true; pack: Pack; added: boolean } | { entry: IndexEntry; ok: false; problem: Problem }

export interface DownloadOptions {
  fetch: Fetcher
  store: PackStore
  baseUrl: string
  index: PackIndex
  local: ReadonlyMap<string, number> // the device's pack versions
  packs: readonly Pack[] // the device's packs, for the card ids no new pack may reuse
  timeoutMs?: number
  onStart?: (entry: IndexEntry) => void
  onBytes?: (entry: IndexEntry, bytes: Bytes) => void
  onDone?: (outcome: PackOutcome) => void
}

/** Downloads, checks and saves the given packs one by one; one failing never stops the others. */
export async function downloadPacks(entries: readonly IndexEntry[], options: DownloadOptions): Promise<PackOutcome[]> {
  const categories = new Set(options.index.categories.map((category) => category.id))
  const known = [...options.packs]
  const outcomes: PackOutcome[] = []
  for (const entry of entries) {
    options.onStart?.(entry)
    const outcome = await downloadOne(entry, options, categories, known)
    if (outcome.ok) known.push(outcome.pack)
    outcomes.push(outcome)
    options.onDone?.(outcome)
  }
  return outcomes
}

async function downloadOne(entry: IndexEntry, options: DownloadOptions, categories: Set<string>, known: Pack[]): Promise<PackOutcome> {
  const fail = (problem: Problem, detail?: unknown): PackOutcome => {
    console.error(`Pack ${entry.id} was not saved: ${problem}`, detail ?? '')
    return { entry, ok: false, problem }
  }
  const file = await download(options.fetch, `${options.baseUrl}packs/${entry.file}`, options.timeoutMs, (bytes) => options.onBytes?.(entry, bytes))
  if (!file.ok) return fail(file.problem)
  if (newerSchema(file.data)) return fail('too-new')
  const check = validatePack(file.data, categories)
  if (!check.ok) return fail('invalid', check.errors)
  const pack = check.value
  if (pack.id !== entry.id || pack.category !== entry.category) return fail('invalid', 'the file is not the pack the index names')
  // Right after a deploy the CDN may still hand out the previous file for up to ten minutes.
  if (pack.version !== entry.version) return fail('stale')
  const clashes = clashingCardIds(pack, known)
  if (clashes.length > 0) return fail('invalid', `card ids used by another pack: ${clashes.join(', ')}`)
  try {
    if (!(await options.store.saveIfNewer(pack))) return { entry, ok: true, pack, added: false }
  } catch (error) {
    return fail('storage', error)
  }
  return { entry, ok: true, pack, added: !options.local.has(pack.id) }
}

/** Index entries the device lacks or has in an older version. */
export const missing = (entries: readonly IndexEntry[], local: ReadonlyMap<string, number>): IndexEntry[] =>
  entries.filter((entry) => (local.get(entry.id) ?? 0) < entry.version)

/**
 * The packs that download by themselves (plan 4.2): every pack of an interest, a newer version of every pack on the
 * device, and the packs of any category a card on the device comes from (its progress or the weekend list).
 */
export function automaticPacks(index: PackIndex, local: ReadonlyMap<string, number>, interests: readonly string[], usedCategories: ReadonlySet<string>): IndexEntry[] {
  return missing(
    index.packs.filter((entry) => interests.includes(entry.category) || local.has(entry.id) || usedCategories.has(entry.category)),
    local,
  )
}

/** The in-memory pack list after a download: saved packs replace their old copies. */
export function mergePacks(current: readonly Pack[], saved: readonly Pack[]): Pack[] {
  const byId = new Map(current.map((pack) => [pack.id, pack]))
  for (const pack of saved) byId.set(pack.id, pack)
  return [...byId.values()]
}
