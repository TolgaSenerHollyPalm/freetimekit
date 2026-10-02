import { backupFileName, createBackup, readBackup, type BackupAdapter } from 'kitshelf-ui/backup/format.ts'
import { readErrorMessage } from 'kitshelf-ui/backup/texts.ts'
import { describe, expect, it } from 'vitest'
import { at, dayLog, opened } from '../cards/test-helpers.ts'
import type { WeekendItem } from '../cards/types.ts'
import { KIT, KIT_NAME } from '../kit.ts'
import { DATA_VERSION } from '../storage/migrations.ts'
import { BACKUP_TEXTS, latestChange, migrateKit, REPLACE_WARNING, summarizeKit, typographic, validateKitData } from './kitBackup.ts'
import type { KitData } from './restorePlan.ts'

const fromCard: WeekendItem = { id: 'w1', kind: 'card', cardId: 'tarih-001', title: 'Kart', category: 'tarih', addedAt: at('2026-09-20'), updatedAt: at('2026-09-20') }
const own: WeekendItem = { id: 'w2', kind: 'own', title: 'Tatil', questions: ['Nereye?', 'Ne zaman?'], addedAt: at('2026-09-22'), updatedAt: at('2026-09-23') }
const data: KitData = {
  settings: { interests: ['tarih', 'bilim'], updatedAt: at('2026-09-19') },
  progress: [{ ...opened('tarih-001', '2026-09-20', true), answers: { 'tarih-001-q1': 0, 'tarih-001-q2': 3 } }, opened('bilim-002', '2026-09-21')],
  days: [dayLog('2026-09-20', 'tarih-001', ['tarih-001'], { suggestedCardIds: ['bilim-002'] }), dayLog('2026-09-21', 'bilim-002', [], { repeat: true })],
  weekend: [fromCard, own],
}

type Loose = Record<string, unknown>
const changed = (list: 'progress' | 'days' | 'weekend', change: (record: Loose) => void, index = 0): unknown => {
  const copy = structuredClone(data) as unknown as Record<string, Loose[]>
  change(copy[list][index])
  return copy
}

describe('validateKitData', () => {
  it('accepts what the app stores: with or without settings, with empty lists, with the welcome’s unstamped settings', () => {
    expect(validateKitData(data)).toBe(true)
    expect(validateKitData({ progress: [], days: [], weekend: [] })).toBe(true)
    expect(validateKitData({ ...data, settings: { interests: ['doga'] } })).toBe(true)
  })

  it('refuses the whole file for one broken card record', () => {
    const cases = [
      changed('progress', (p) => (p.cardId = '')),
      changed('progress', (p) => (p.openedAt = 'dün')),
      changed('progress', (p) => (p.answers = { 'tarih-001-q1': 4 })),
      changed('progress', (p) => (p.answers = { 'tarih-001-q1': 1.5 })),
      changed('progress', (p) => (p.answers = 'hepsi')),
      changed('progress', (p) => (p.completedAt = 7)),
      changed('progress', (p) => delete p.updatedAt),
    ]
    for (const each of cases) expect(validateKitData(each), JSON.stringify(each)).toBe(false)
  })

  it('refuses a broken day', () => {
    const cases = [
      changed('days', (d) => (d.date = '2026-02-30')),
      changed('days', (d) => (d.dailyCardId = '')),
      changed('days', (d) => (d.repeat = 'hayır')),
      changed('days', (d) => (d.suggestedCardIds = 'bilim-002')),
      changed('days', (d) => (d.countedCardIds = [1])),
    ]
    for (const each of cases) expect(validateKitData(each), JSON.stringify(each)).toBe(false)
  })

  it('refuses a list item the screens could not show', () => {
    const cases = [
      changed('weekend', (w) => (w.kind = 'book')),
      changed('weekend', (w) => delete w.cardId),
      changed('weekend', (w) => (w.title = ' ')),
      changed('weekend', (w) => delete w.addedAt),
      changed('weekend', (w) => (w.questions = []), 1),
      changed('weekend', (w) => (w.questions = ['1', '2', '3', '4']), 1),
      changed('weekend', (w) => (w.questions = ['x'.repeat(201)]), 1),
      changed('weekend', (w) => (w.title = 'x'.repeat(61)), 1),
    ]
    for (const each of cases) expect(validateKitData(each), JSON.stringify(each)).toBe(false)
  })

  it('refuses settings without interests, a key used twice, and anything that is not this kit’s data', () => {
    const twice = (list: 'progress' | 'days' | 'weekend') => ({ ...data, [list]: [data[list][0], data[list][0]] })
    const cases = [
      { ...data, settings: { interests: [] } },
      { ...data, settings: { interests: ['tarih', 'tarih'] } },
      { ...data, settings: { interests: 'tarih' } },
      twice('progress'),
      twice('days'),
      twice('weekend'),
      { ...data, weekend: undefined },
      { movements: [] },
      null,
      [],
    ]
    for (const each of cases) expect(validateKitData(each), JSON.stringify(each)).toBe(false)
  })
})

describe('summarizeKit, migrateKit and latestChange', () => {
  it('counts the finished cards and the topics', () => {
    expect(summarizeKit(data)).toEqual([
      { key: 'finished', count: 1, label: 'biten kart' },
      { key: 'topics', count: 2, label: 'konu' },
    ])
  })

  it('passes the current version through and refuses one it does not know', () => {
    expect(migrateKit(data, DATA_VERSION)).toBe(data)
    expect(() => migrateKit(data, DATA_VERSION + 1)).toThrow()
    expect(() => migrateKit(data, 0)).toThrow()
  })

  it('finds the newest stamp of any record or of the settings', () => {
    expect(latestChange(data)).toBe(at('2026-09-23'))
    expect(latestChange({ ...data, settings: { interests: ['tarih'], updatedAt: at('2026-09-30') } })).toBe(at('2026-09-30'))
    expect(latestChange({ progress: [], days: [dayLog('2026-09-28')], weekend: [] })).toBe(at('2026-09-28'))
    expect(latestChange({ progress: [], days: [], weekend: [] })).toBeUndefined()
  })
})

describe('the texts', () => {
  it('speak of cards, the streak and the list, not of another kit’s things', () => {
    for (const words of [...Object.values(BACKUP_TEXTS), ...Object.values(REPLACE_WARNING)]) expect(words).not.toMatch(/seyahat|kitap|hareket|birikim/i)
  })

  it('put the kit’s apostrophe into kitshelf-ui’s messages', () => {
    expect(typographic(readErrorMessage('other-kit', KIT_NAME, 'BookKit'))).toBe('Bu bir BookKit yedeği. FreeTimeKit’e yalnızca FreeTimeKit yedekleri yüklenebilir.')
    expect(typographic(readErrorMessage('too-new', KIT_NAME))).toBe('Bu yedek FreeTimeKit’in daha yeni bir sürümüyle alınmış. Önce uygulamayı güncelle, sonra tekrar dene.')
  })
})

// The same pieces the settings screen hands to kitshelf-ui, without React around them.
const adapter = (kit: KitData): BackupAdapter<KitData> => ({
  kit: KIT,
  kitName: KIT_NAME,
  dataVersion: DATA_VERSION,
  appBuild: 'test',
  exportData: () => kit,
  summarize: summarizeKit,
  migrate: migrateKit,
  validate: validateKitData,
  restore: async () => [],
  lastChangeAt: () => latestChange(kit),
  hasUserData: () => kit.progress.length > 0 || kit.weekend.length > 0,
})

describe('a backup file', () => {
  const now = new Date('2026-10-02T12:00:00.000Z')
  const backup = createBackup(adapter(data), now)
  const empty: KitData = { progress: [], days: [], weekend: [] }
  const file = (content: unknown) => new File([JSON.stringify(content)], 'x.json')

  it('is named after the kit and reads back as the same records and settings', async () => {
    expect(backupFileName(KIT, now)).toBe('freetimekit-yedek-2026-10-02.json')
    const read = await readBackup(file(backup), adapter(empty))
    expect(read.ok && read.backup.data).toEqual(data)
    expect(read.ok && read.preview.counts).toEqual(summarizeKit(data))
  })

  it('carries no packs and no table', () => {
    expect(Object.keys(backup.data).sort()).toEqual(['days', 'progress', 'settings', 'weekend'])
    expect(backup.summary).toEqual({ finished: 1, topics: 2 })
  })

  it('of another kit is turned away by name, and one from a newer version asks for an update', async () => {
    expect(await readBackup(file({ ...backup, kit: 'bookkit', kitName: 'BookKit' }), adapter(empty))).toEqual({ ok: false, error: 'other-kit', kitName: 'BookKit' })
    expect(await readBackup(file({ ...backup, dataVersion: DATA_VERSION + 1 }), adapter(empty))).toEqual({ ok: false, error: 'too-new' })
  })

  it('with one broken record is refused whole', async () => {
    const damaged = { ...backup, data: { ...data, progress: [...data.progress, { cardId: 'x' }] } }
    expect(await readBackup(file(damaged), adapter(empty))).toEqual({ ok: false, error: 'damaged' })
  })
})
