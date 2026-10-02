import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import type { CardProgress, DayLog, Settings, TableSession, WeekendItem } from '../cards/types.ts'
import { DATABASE_NAME } from '../kit.ts'
import type { Pack, PackIndex } from '../packs/types.ts'
import { DATA_VERSION, migrateRecord, type RecordKind } from './migrations.ts'

type MetaKey = 'settings' | 'packIndex' | 'lastSyncAt' | 'table'

interface FreeTimeKitDB extends DBSchema {
  packs: { key: string; value: Pack }
  progress: { key: string; value: CardProgress }
  days: { key: string; value: DayLog }
  weekend: { key: string; value: WeekendItem }
  meta: { key: MetaKey; value: Settings | PackIndex | string | TableSession }
}

export interface Stored {
  packs: Pack[]
  progress: CardProgress[]
  days: DayLog[]
  weekend: WeekendItem[]
  settings?: Settings // absent until the first-run welcome is answered
  packIndex?: PackIndex // the server's, once one newer than the bundled copy arrived
  lastSyncAt?: string
  table?: TableSession
}

let connection: Promise<IDBPDatabase<FreeTimeKitDB>> | undefined
let waitingForAnotherTab = false

/** True while an upgrade is stuck behind an older copy of the app open in another tab or window. */
export const blockedByAnotherTab = () => waitingForAnotherTab

const RECORD_STORES = ['progress', 'days', 'weekend'] as const satisfies readonly RecordKind[]

function database() {
  connection ??= openDB<FreeTimeKitDB>(DATABASE_NAME, DATA_VERSION, {
    async upgrade(db, oldVersion, _newVersion, tx) {
      if (oldVersion < 1) {
        db.createObjectStore('packs', { keyPath: 'id' })
        db.createObjectStore('progress', { keyPath: 'cardId' })
        db.createObjectStore('days', { keyPath: 'date' })
        db.createObjectStore('weekend', { keyPath: 'id' })
        db.createObjectStore('meta')
        return
      }
      // An older device: every stored record takes the steps a backup of that age would (storage/migrations.ts).
      for (const name of RECORD_STORES) {
        const store = tx.objectStore(name)
        for (const record of await store.getAll()) await store.put(migrateRecord(name, record, oldVersion) as never)
      }
      const settings = await tx.objectStore('meta').get('settings')
      if (settings) await tx.objectStore('meta').put(migrateRecord('settings', settings, oldVersion), 'settings')
    },
    // An upgrade cannot run while an older copy of the app still holds the database open.
    blocked() {
      waitingForAnotherTab = true
    },
    blocking() {
      // Another tab wants to upgrade: let go of the database so it can, and reopen on the next call.
      const open = connection
      connection = undefined
      open?.then((db) => db.close()).catch(() => undefined)
    },
    terminated() {
      connection = undefined
    },
  })
  return connection
}

/** Lets go of the database, so deleting it is not blocked by our own connection. */
export async function closeDatabase(): Promise<void> {
  const open = connection
  connection = undefined
  await open?.then((db) => db.close()).catch(() => undefined)
}

export async function loadAll(): Promise<Stored> {
  const db = await database()
  const tx = db.transaction(['packs', 'progress', 'days', 'weekend', 'meta'])
  const meta = tx.objectStore('meta')
  const [packs, progress, days, weekend, settings, packIndex, lastSyncAt, table] = await Promise.all([
    tx.objectStore('packs').getAll(),
    tx.objectStore('progress').getAll(),
    tx.objectStore('days').getAll(),
    tx.objectStore('weekend').getAll(),
    meta.get('settings'),
    meta.get('packIndex'),
    meta.get('lastSyncAt'),
    meta.get('table'),
  ])
  // The list keeps the order things were added in.
  weekend.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
  return {
    packs,
    progress,
    days,
    weekend,
    settings: settings as Settings | undefined,
    packIndex: packIndex as PackIndex | undefined,
    lastSyncAt: lastSyncAt as string | undefined,
    table: table as TableSession | undefined,
  }
}

export async function packVersions(): Promise<Map<string, number>> {
  const db = await database()
  const packs = await db.getAll('packs')
  return new Map(packs.map((pack) => [pack.id, pack.version]))
}

/** Replaces the pack only with a newer version, read and written in one transaction. */
export async function savePackIfNewer(pack: Pack): Promise<boolean> {
  const db = await database()
  const tx = db.transaction('packs', 'readwrite')
  const current = await tx.store.get(pack.id)
  if (current && current.version >= pack.version) {
    await tx.done
    return false
  }
  await Promise.all([tx.store.put(pack), tx.done])
  return true
}

export async function saveProgress(progress: CardProgress): Promise<void> {
  const db = await database()
  await db.put('progress', progress)
}

export async function saveDay(day: DayLog): Promise<void> {
  const db = await database()
  await db.put('days', day)
}

export async function saveWeekendItem(item: WeekendItem): Promise<void> {
  const db = await database()
  await db.put('weekend', item)
}

export async function deleteWeekendItems(ids: readonly string[]): Promise<void> {
  const db = await database()
  const tx = db.transaction('weekend', 'readwrite')
  await Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done])
}

export async function saveMeta(key: 'settings', value: Settings): Promise<void>
export async function saveMeta(key: 'packIndex', value: PackIndex): Promise<void>
export async function saveMeta(key: 'lastSyncAt', value: string): Promise<void>
export async function saveMeta(key: 'table', value: TableSession): Promise<void>
export async function saveMeta(key: MetaKey, value: Settings | PackIndex | string | TableSession): Promise<void> {
  const db = await database()
  await db.put('meta', value, key)
}

export async function deleteTable(): Promise<void> {
  const db = await database()
  await db.delete('meta', 'table')
}

/** Asks the browser not to clear our data when the device runs low on space. */
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => {
    // Not granted; the data is still stored, just without the guarantee.
  })
}
