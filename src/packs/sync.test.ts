import { describe, expect, it, vi } from 'vitest'
import { card, index, pack } from '../cards/test-helpers.ts'
import { automaticPacks, download, downloadPacks, fetchIndex, missing, type Fetcher, type PackStore } from './sync.ts'
import type { Pack } from './types.ts'
import { clashingCardIds, validatePack } from './validate.ts'

const json = (data: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(data), { status: 200, ...init })
const tarih = pack('tarih', [card('tarih-001'), card('tarih-002')])
const bilim = pack('bilim', [card('bilim-001')])
const idx = index([tarih, bilim])

function serve(files: Record<string, unknown>): { fetch: Fetcher; asked: { url: string; init: RequestInit }[] } {
  const asked: { url: string; init: RequestInit }[] = []
  const fetch: Fetcher = async (url, init) => {
    asked.push({ url, init })
    const name = url.replace(/^.*packs\//, '')
    if (!(name in files)) return new Response('Not found', { status: 404 })
    const body = files[name]
    return body instanceof Response ? body : json(body)
  }
  return { fetch, asked }
}

function memoryStore(initial: Pack[] = []): PackStore & { saved: Pack[] } {
  const packs = new Map(initial.map((p) => [p.id, p]))
  return {
    saved: [],
    versions: async () => new Map([...packs.values()].map((p) => [p.id, p.version])),
    async saveIfNewer(p) {
      if ((packs.get(p.id)?.version ?? 0) >= p.version) return false
      packs.set(p.id, p)
      this.saved.push(p)
      return true
    },
  }
}

describe('downloading a file', () => {
  it('asks past the browser cache and reads JSON', async () => {
    const { fetch, asked } = serve({ 'index.json': idx })
    expect(await fetchIndex(fetch, '/')).toEqual({ ok: true, index: idx })
    expect(asked[0]).toMatchObject({ url: '/packs/index.json', init: { cache: 'no-store' } })
  })

  it('tells a Wi-Fi login page, a broken file, a missing one and a newer schema apart', async () => {
    const { fetch } = serve({ 'a.json': new Response('<html>Giriş yap</html>'), 'b.json': new Response('{nope'), 'index.json': { ...idx, schemaVersion: 2 } })
    expect(await download(fetch, '/packs/a.json')).toEqual({ ok: false, problem: 'web-page' })
    expect(await download(fetch, '/packs/b.json')).toEqual({ ok: false, problem: 'broken' })
    expect(await download(fetch, '/packs/c.json')).toEqual({ ok: false, problem: 'not-found' })
    expect(await fetchIndex(fetch, '/')).toEqual({ ok: false, problem: 'too-new' })
  })

  it('gives up after the timeout, also while the body is still arriving', async () => {
    vi.useFakeTimers()
    try {
      const stalled: Fetcher = async (_url, init) =>
        new Response(new ReadableStream({ start: (controller) => init.signal?.addEventListener('abort', () => controller.error(new DOMException('aborted', 'AbortError'))) }))
      const result = download(stalled, '/packs/x.json', 10_000, () => undefined)
      await vi.advanceTimersByTimeAsync(10_001)
      expect(await result).toEqual({ ok: false, problem: 'timeout' })
    } finally {
      vi.useRealTimers()
    }
  })

  it('reports the bytes as they come, with the total only for an uncompressed answer', async () => {
    const body = JSON.stringify(tarih)
    const seen: { loaded: number; total?: number }[] = []
    const plain: Fetcher = async () => new Response(body, { headers: { 'content-length': String(new TextEncoder().encode(body).length) } })
    await download(plain, '/x', 10_000, (bytes) => seen.push(bytes))
    expect(seen.at(-1)).toEqual({ loaded: new TextEncoder().encode(body).length, total: new TextEncoder().encode(body).length })
    const zipped: Fetcher = async () => new Response(body, { headers: { 'content-length': '10', 'content-encoding': 'gzip' } })
    seen.length = 0
    await download(zipped, '/x', 10_000, (bytes) => seen.push(bytes))
    expect(seen.at(-1)?.total).toBeUndefined()
  })
})

describe('downloading packs', () => {
  const options = (store: PackStore, fetch: Fetcher, packs: Pack[] = []) => ({ fetch, store, baseUrl: '/', index: idx, local: new Map(packs.map((p) => [p.id, p.version])), packs })

  it('checks and saves each pack, telling which were new', async () => {
    const store = memoryStore()
    const { fetch } = serve({ 'ftk-tarih-1.json': tarih, 'ftk-bilim-1.json': bilim })
    const outcomes = await downloadPacks(idx.packs, options(store, fetch))
    expect(outcomes.map((o) => [o.entry.id, o.ok, o.ok && o.added])).toEqual([
      ['ftk-tarih-1', true, true],
      ['ftk-bilim-1', true, true],
    ])
    expect(store.saved.map((p) => p.id)).toEqual(['ftk-tarih-1', 'ftk-bilim-1'])
  })

  it('keeps going when one pack is broken, stale or reuses another pack’s card ids', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    const store = memoryStore()
    const broken = { ...tarih, cards: [{ ...tarih.cards[0], questions: [] }] }
    const { fetch } = serve({ 'ftk-tarih-1.json': broken, 'ftk-bilim-1.json': { ...bilim, version: 1 } })
    const stale = { ...idx, packs: [idx.packs[0], { ...idx.packs[1], version: 2 }] }
    const outcomes = await downloadPacks(stale.packs, { ...options(store, fetch), index: stale })
    expect(outcomes.map((o) => (o.ok ? 'ok' : o.problem))).toEqual(['invalid', 'stale'])
    expect(store.saved).toEqual([])

    const thief = pack('bilim', [card('tarih-001')])
    expect(clashingCardIds({ ...thief, category: 'bilim' }, [tarih])).toEqual(['tarih-001'])
  })

  it('never replaces a pack with an older version', async () => {
    const store = memoryStore([{ ...tarih, version: 3 }])
    const { fetch } = serve({ 'ftk-tarih-1.json': tarih })
    const [outcome] = await downloadPacks([idx.packs[0]], options(store, fetch, [{ ...tarih, version: 3 }]))
    expect(outcome).toMatchObject({ ok: true, added: false })
    expect(store.saved).toEqual([])
  })
})

describe('which packs download by themselves', () => {
  const big = index([tarih, bilim, pack('doga', [card('doga-001')]), pack('sanat', [card('sanat-001')])])

  it('are the interests’ packs, newer versions of the device’s packs and the categories its records use', () => {
    const local = new Map([['ftk-doga-1', 1]])
    const newer = { ...big, packs: big.packs.map((e) => (e.id === 'ftk-doga-1' ? { ...e, version: 2 } : e)) }
    expect(automaticPacks(newer, local, ['tarih'], new Set(['sanat'])).map((e) => e.id)).toEqual(['ftk-tarih-1', 'ftk-doga-1', 'ftk-sanat-1'])
    expect(automaticPacks(big, local, ['tarih'], new Set()).map((e) => e.id)).toEqual(['ftk-tarih-1'])
    expect(missing(big.packs, new Map([['ftk-tarih-1', 1], ['ftk-bilim-1', 1]])).map((e) => e.id)).toEqual(['ftk-doga-1', 'ftk-sanat-1'])
  })
})

describe('checking a pack', () => {
  const ok = new Set(['tarih', 'bilim'])
  const broken = (change: (p: Record<string, unknown>) => void) => {
    const copy = structuredClone(tarih) as unknown as Record<string, unknown>
    change(copy)
    return validatePack(copy, ok)
  }

  it('accepts a good one', () => {
    expect(validatePack(tarih, ok)).toEqual({ ok: true, value: tarih })
  })

  it.each([
    ['a newer schema', (p: Record<string, unknown>) => (p.schemaVersion = 2)],
    ['a category the index lacks', (p: Record<string, unknown>) => (p.category = 'mitoloji')],
    ['a card of another category', (p: Record<string, unknown>) => ((p.cards as { id: string }[])[0].id = 'bilim-001')],
    ['an id used twice', (p: Record<string, unknown>) => ((p.cards as { id: string }[])[1].id = 'tarih-001')],
    ['two facts', (p: Record<string, unknown>) => ((p.cards as { facts: string[] }[])[0].facts = ['a', 'b'])],
    ['an empty discussion line', (p: Record<string, unknown>) => ((p.cards as { discussion: string[] }[])[0].discussion = ['Sence?', ' '])],
    ['three options', (p: Record<string, unknown>) => ((p.cards as { questions: { options: string[] }[] }[])[0].questions[0].options = ['A', 'B', 'C'])],
    ['the same option twice', (p: Record<string, unknown>) => ((p.cards as { questions: { options: string[] }[] }[])[0].questions[0].options = ['A', 'B', 'C', 'a'])],
    ['an answer out of range', (p: Record<string, unknown>) => ((p.cards as { questions: { answerIndex: number }[] }[])[0].questions[0].answerIndex = 4)],
    ['a source without an address', (p: Record<string, unknown>) => ((p.cards as { sources: unknown[] }[])[0].sources = [{ name: 'X', url: 'yok' }])],
  ])('refuses %s', (_label, change) => {
    expect(broken(change).ok).toBe(false)
  })
})
