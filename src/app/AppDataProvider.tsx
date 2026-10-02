import { trackDataSince } from 'kitshelf-ui/backup/state.ts'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ensureDay } from '../cards/daily.ts'
import { toDay } from '../cards/dates.ts'
import { buildLibrary } from '../cards/library.ts'
import { answerQuestion, countDay, openCard as startCard } from '../cards/progress.ts'
import type { DayLog, Settings, TableSession, WeekendItem } from '../cards/types.ts'
import { editTopic, ownTopic, removeItem, toggleCard } from '../cards/weekend.ts'
import { KIT } from '../kit.ts'
import { bundledIndex } from '../packs/bundled.ts'
import { automaticPacks, downloadPacks, fetchIndex, mergePacks, missing } from '../packs/sync.ts'
import { cardCategory, type Card, type IndexEntry, type PackIndex } from '../packs/types.ts'
import {
  blockedByAnotherTab,
  deleteTable,
  deleteWeekendItems,
  loadAll,
  packVersions,
  requestPersistentStorage,
  saveDay,
  saveMeta,
  savePackIfNewer,
  saveProgress,
  saveWeekendItem,
  type Stored,
} from '../storage/db.ts'
import { AppDataContext, type CategorySync, type SyncStatus } from './appData.ts'
import styles from './AppDataProvider.module.css'

const SYNC_AFTER_MS = 6 * 60 * 60 * 1000

// The provider is mounted once, so module-level state is enough: the data as it is right now,
// which two changes in a row build on rather than on the last render.
let current: Stored = { packs: [], progress: [], days: [], weekend: [] }
let syncing = false

/** The server's index once a newer one arrived, else the copy inside the app. */
const indexOf = (stored: Pick<Stored, 'packIndex'>): PackIndex => {
  const bundled = bundledIndex()
  return stored.packIndex && stored.packIndex.updatedAt > bundled.updatedAt ? stored.packIndex : bundled
}
const libraryOf = (stored: Stored) => buildLibrary(indexOf(stored), stored.packs)

/** Categories a card on the device comes from, so a restored record finds its pack (plan 4.2). */
const usedCategories = (stored: Stored) =>
  new Set([...stored.progress.map((p) => cardCategory(p.cardId)), ...stored.weekend.flatMap((item) => (item.cardId ? [cardCategory(item.cardId)] : []))])

const withDay = (days: readonly DayLog[], log: DayLog) => [...days.filter((day) => day.date !== log.date), log]
const stamp = (item: WeekendItem, now: Date): WeekendItem => ({ ...item, updatedAt: now.toISOString() })

/** Loads everything from IndexedDB once, then keeps it in memory, writes every change back and keeps the packs fresh. */
export default function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Stored>()
  const [day, setDay] = useState(() => toDay(new Date()))
  const [sync, setSync] = useState<SyncStatus>({ running: false, failed: false, categories: {} })
  const [loadFailed, setLoadFailed] = useState(false)
  const [slowLoad, setSlowLoad] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  const apply = useCallback((next: Stored) => {
    current = next
    // The backup reminder's clock starts with the first record and stops when the last one is gone.
    trackDataSince(KIT, next.progress.length > 0 || next.weekend.length > 0, new Date())
    setData(next)
  }, [])

  const report = useCallback((error: unknown) => {
    console.error(error)
    setSaveFailed(true)
  }, [])

  /** Today's record, made before anything of the day is written; picked again only by ensureDay's own rules. */
  const ensureToday = useCallback(
    (now = new Date()): DayLog | undefined => {
      const stored = current
      if (!stored.settings) return undefined
      const date = toDay(now)
      const existing = stored.days.find((log) => log.date === date)
      const progress = new Map(stored.progress.map((p) => [p.cardId, p]))
      const log = ensureDay(existing, { library: libraryOf(stored), interests: stored.settings.interests, progress, days: stored.days, today: date }, now)
      if (log !== existing) {
        apply({ ...stored, days: withDay(stored.days, log) })
        saveDay(log).catch(report)
      }
      return log
    },
    [apply, report],
  )

  const syncPacks = useCallback(
    async (explicit: readonly string[] = []) => {
      if (syncing || !navigator.onLine || (!current.settings && explicit.length === 0)) return
      syncing = true
      const waiting = Object.fromEntries(explicit.map((category) => [category, { state: 'downloading', done: 0, total: 0 } as CategorySync]))
      setSync((old) => ({ running: true, failed: false, categories: { ...old.categories, ...waiting } }))
      try {
        const result = await fetchIndex((url, init) => fetch(url, init), import.meta.env.BASE_URL)
        if (!result.ok) {
          console.error('Pack index could not be fetched:', result.problem)
          setSync((old) => ({ running: false, failed: true, categories: { ...old.categories, ...Object.fromEntries(explicit.map((c) => [c, { state: 'failed' }])) } }))
          return
        }
        let index = indexOf(current)
        if (result.index.updatedAt > index.updatedAt) {
          index = result.index
          apply({ ...current, packIndex: index })
          saveMeta('packIndex', index).catch(report)
        }
        const syncedAt = new Date().toISOString()
        apply({ ...current, lastSyncAt: syncedAt })
        saveMeta('lastSyncAt', syncedAt).catch(report)

        const local = new Map(current.packs.map((pack) => [pack.id, pack.version]))
        const auto = automaticPacks(index, local, current.settings?.interests ?? [], usedCategories(current))
        const asked = missing(index.packs.filter((entry) => explicit.includes(entry.category)), local).filter((entry) => !auto.includes(entry))
        const entries: IndexEntry[] = [...auto, ...asked]
        const totals = new Map<string, number>()
        for (const entry of entries) totals.set(entry.category, (totals.get(entry.category) ?? 0) + 1)
        const progress = new Map<string, CategorySync>()
        for (const [category, total] of totals) progress.set(category, { state: 'downloading', done: 0, total })
        const show = (failed = false) =>
          setSync((old) => ({ running: !failed && syncing, failed, categories: { ...old.categories, ...Object.fromEntries(progress), ...Object.fromEntries(explicit.filter((c) => !totals.has(c)).map((c) => [c, { state: 'idle' }])) } }))
        show()
        const failedCategories = new Set<string>()
        const outcomes = await downloadPacks(entries, {
          fetch: (url, init) => fetch(url, init),
          store: { versions: packVersions, saveIfNewer: savePackIfNewer },
          baseUrl: import.meta.env.BASE_URL,
          index,
          local,
          packs: current.packs,
          onBytes: (entry, bytes) => {
            const state = progress.get(entry.category)
            if (state?.state !== 'downloading' || state.total !== 1 || bytes.total === undefined) return
            progress.set(entry.category, { ...state, fraction: Math.min(1, bytes.loaded / bytes.total) })
            show()
          },
          onDone: (outcome) => {
            const state = progress.get(outcome.entry.category)
            if (outcome.ok) apply({ ...current, packs: mergePacks(current.packs, [outcome.pack]) })
            else failedCategories.add(outcome.entry.category)
            if (state?.state === 'downloading') progress.set(outcome.entry.category, { ...state, done: state.done + 1, fraction: undefined })
            show()
          },
        })
        for (const category of totals.keys()) progress.set(category, failedCategories.has(category) ? { state: 'failed' } : { state: 'idle' })
        // Once the whole round is in, so a day picked meanwhile does not draw on the first pack alone.
        if (outcomes.some((outcome) => outcome.ok)) ensureToday()
        syncing = false
        show(outcomes.length > 0 && outcomes.every((outcome) => !outcome.ok))
      } finally {
        syncing = false
        setSync((old) => ({ ...old, running: false }))
      }
    },
    [apply, ensureToday, report],
  )

  useEffect(() => {
    let active = true
    requestPersistentStorage()
    loadAll()
      .then((stored) => {
        if (!active) return
        apply(stored)
        ensureToday()
        const last = stored.lastSyncAt ? Date.parse(stored.lastSyncAt) : 0
        if (Date.now() - last > SYNC_AFTER_MS) void syncPacks()
      })
      .catch((error: unknown) => {
        console.error(error)
        if (active) setLoadFailed(true)
      })
    return () => {
      active = false
    }
  }, [apply, ensureToday, syncPacks])

  // Back online: the packs that waited for a connection come down.
  useEffect(() => {
    const retry = () => void syncPacks()
    window.addEventListener('online', retry)
    return () => window.removeEventListener('online', retry)
  }, [syncPacks])

  // The day changes at local midnight, also while the app stays open.
  useEffect(() => {
    const check = () => {
      const now = new Date()
      setDay(toDay(now))
      if (current.settings) ensureToday(now)
    }
    const timer = setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    window.addEventListener('focus', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
      window.removeEventListener('focus', check)
    }
  }, [ensureToday])

  // Opening takes a moment; if it takes this long, something is in the way and the user should know.
  useEffect(() => {
    if (data) return undefined
    const timer = setTimeout(() => setSlowLoad(true), 5000)
    return () => clearTimeout(timer)
  }, [data])

  const saveSettings = useCallback(
    (next: Settings) => {
      apply({ ...current, settings: next })
      saveMeta('settings', next).catch(report)
      ensureToday()
    },
    [apply, ensureToday, report],
  )

  const openCard = useCallback(
    (cardId: string) => {
      const now = new Date()
      const log = ensureToday(now)
      if (!current.progress.some((p) => p.cardId === cardId)) {
        const progress = startCard(undefined, cardId, now)
        apply({ ...current, progress: [...current.progress, progress] })
        saveProgress(progress).catch(report)
      }
      // A repeat day's card was finished before, so opening it is what makes the day count.
      if (log?.repeat && log.dailyCardId === cardId) {
        const counted = countDay(log, cardId, now)
        if (counted !== log) {
          apply({ ...current, days: withDay(current.days, counted) })
          saveDay(counted).catch(report)
        }
      }
    },
    [apply, ensureToday, report],
  )

  const answer = useCallback(
    (cardId: string, questionId: string, choice: number) => {
      const card = libraryOf(current).cards.get(cardId)
      if (!card) return
      const now = new Date()
      const log = ensureToday(now)
      const base = current.progress.find((p) => p.cardId === cardId) ?? startCard(undefined, cardId, now)
      const { progress, completed } = answerQuestion(base, card, questionId, choice, now)
      if (progress === base) return
      apply({ ...current, progress: [...current.progress.filter((p) => p.cardId !== cardId), progress] })
      saveProgress(progress).catch(report)
      if (completed && log) {
        const counted = countDay(log, cardId, now)
        apply({ ...current, days: withDay(current.days, counted) })
        saveDay(counted).catch(report)
      }
    },
    [apply, ensureToday, report],
  )

  const toggleWeekend = useCallback(
    (card: Card) => {
      const now = new Date()
      ensureToday(now)
      const before = current.weekend
      const after = toggleCard(before, card, now)
      apply({ ...current, weekend: after })
      const added = after.find((item) => !before.includes(item))
      if (added) saveWeekendItem(added).catch(report)
      else deleteWeekendItems(before.filter((item) => !after.includes(item)).map((item) => item.id)).catch(report)
    },
    [apply, ensureToday, report],
  )

  const addOwnTopic = useCallback(
    (title: string, questions: string[]) => {
      const now = new Date()
      ensureToday(now)
      const item = ownTopic(title, questions, now)
      apply({ ...current, weekend: [...current.weekend, item] })
      saveWeekendItem(item).catch(report)
    },
    [apply, ensureToday, report],
  )

  const editOwnTopic = useCallback(
    (id: string, title: string, questions: string[]) => {
      const old = current.weekend.find((item) => item.id === id)
      if (!old) return
      const item = stamp(editTopic(old, title, questions), new Date())
      apply({ ...current, weekend: current.weekend.map((other) => (other.id === id ? item : other)) })
      saveWeekendItem(item).catch(report)
    },
    [apply, report],
  )

  const removeWeekend = useCallback(
    (id: string) => {
      const removed = current.weekend.find((item) => item.id === id)
      const { list, undo } = removeItem(current.weekend, id)
      apply({ ...current, weekend: list })
      deleteWeekendItems([id]).catch(report)
      return () => {
        if (!removed) return
        apply({ ...current, weekend: undo(current.weekend) })
        saveWeekendItem(removed).catch(report)
      }
    },
    [apply, report],
  )

  const clearWeekend = useCallback(
    (ids: readonly string[]) => {
      apply({ ...current, weekend: current.weekend.filter((item) => !ids.includes(item.id)) })
      deleteWeekendItems(ids).catch(report)
    },
    [apply, report],
  )

  const saveTable = useCallback(
    (session: TableSession | undefined) => {
      if (session) {
        apply({ ...current, table: session })
        saveMeta('table', session).catch(report)
        return
      }
      const { table: _gone, ...rest } = current
      apply(rest)
      deleteTable().catch(report)
    },
    [apply, report],
  )

  const reload = useCallback(async () => {
    apply(await loadAll())
    ensureToday()
    void syncPacks()
  }, [apply, ensureToday, syncPacks])

  const library = useMemo(() => (data ? libraryOf(data) : undefined), [data])
  const value = useMemo(() => {
    if (!data || !library) return undefined
    const days = new Map(data.days.map((log) => [log.date, log]))
    return {
      index: indexOf(data),
      packs: data.packs,
      library,
      settings: data.settings,
      progress: new Map(data.progress.map((p) => [p.cardId, p])),
      days,
      today: day,
      todayLog: days.get(day),
      weekend: data.weekend,
      table: data.table,
      sync,
      saveSettings,
      openCard,
      answer,
      toggleWeekend,
      addOwnTopic,
      editOwnTopic,
      removeWeekend,
      clearWeekend,
      saveTable,
      syncPacks: (categories?: readonly string[]) => void syncPacks(categories),
      reload,
    }
  }, [data, library, day, sync, saveSettings, openCard, answer, toggleWeekend, addOwnTopic, editOwnTopic, removeWeekend, clearWeekend, saveTable, syncPacks, reload])

  if (loadFailed) {
    return <p className={styles.message}>Kayıtlı veriler açılamadı. Uygulamayı kapatıp yeniden aç.</p>
  }
  if (!value) {
    if (slowLoad && blockedByAnotherTab()) {
      return (
        <p className={styles.message}>
          Uygulama başka bir sekmede ya da pencerede daha eski bir sürümle açık. Oradaki sekmeyi kapatıp bu sayfayı
          yenile.
        </p>
      )
    }
    return null
  }

  return (
    <AppDataContext value={value}>
      {saveFailed && (
        <p className={styles.warning} role="alert">
          Son değişiklik kaydedilemedi. Telefonda yer kalmamış olabilir.
        </p>
      )}
      {children}
    </AppDataContext>
  )
}
