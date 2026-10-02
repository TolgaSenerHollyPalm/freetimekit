import type { BackupAdapter, CountLine } from 'kitshelf-ui/backup/format.ts'
import { backupDue } from 'kitshelf-ui/backup/reminder.ts'
import { readBackupState, snoozeReminder, type BackupState } from 'kitshelf-ui/backup/state.ts'
import { useCallback, useMemo, useState } from 'react'
import { useAppData } from '../app/appData.ts'
import type { CardProgress, DayLog, Settings, WeekendItem } from '../cards/types.ts'
import { OWN_QUESTIONS_MAX, QUESTION_MAX, TITLE_MAX } from '../cards/weekend.ts'
import { KIT, KIT_NAME } from '../kit.ts'
import { isDay } from '../packs/validate.ts'
import { restoreBackup } from '../storage/db.ts'
import { DATA_VERSION, migrateRecord, type RecordKind } from '../storage/migrations.ts'
import type { KitData } from './restorePlan.ts'

/** The kit's own words in the shared backup parts (plan 9). */
export const BACKUP_TEXTS = {
  card: 'Bitirdiğin kartlar, serin ve hafta sonu listen yalnızca bu cihazda duruyor. Yedek dosyasını Drive’a, e-postana ya da kendine gönder; telefon değişirse buradan geri yüklersin.',
  merge: 'Bu cihazda olmayanlar eklenir. İkisinde de olanın daha yeni hâli kalır. Hiçbir şey silinmez.',
  replace: 'Bu cihazdaki ilerleme, serin, listen ve ayarların silinir, yerine yedektekiler gelir.',
  banner: 'Telefonun değişirse serin ve listen kaybolmasın.',
}

export const REPLACE_WARNING = {
  title: 'Bu cihazdaki kayıtlar silinsin mi?',
  text: 'Bu cihazdaki ilerlemen, serin, hafta sonu listen ve ayarların silinecek, yerine yedektekiler gelecek. Geri alınamaz.',
}

/** kitshelf-ui's messages with the apostrophe the kit's texts use (plan 9). */
export const typographic = (message: string): string => message.replaceAll("'", '’')

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)
const isText = (value: unknown): value is string => typeof value === 'string'
const isName = (value: unknown): value is string => isText(value) && value.trim() !== ''
const isMoment = (value: unknown): boolean => isText(value) && !Number.isNaN(Date.parse(value))
const isNames = (value: unknown): value is string[] => Array.isArray(value) && value.every(isName)
const maybe = (value: unknown, check: (value: unknown) => boolean): boolean => value === undefined || check(value)
const unique = (keys: readonly string[]) => new Set(keys).size === keys.length

const isAnswers = (value: unknown): boolean =>
  isRecord(value) && Object.entries(value).every(([id, choice]) => id !== '' && Number.isInteger(choice) && (choice as number) >= 0 && (choice as number) <= 3)

const isProgress = (value: unknown): value is CardProgress =>
  isRecord(value) && isName(value.cardId) && isMoment(value.openedAt) && isAnswers(value.answers) && maybe(value.completedAt, isMoment) && isMoment(value.updatedAt)

const isDayLog = (value: unknown): value is DayLog =>
  isRecord(value) &&
  isDay(value.date) &&
  maybe(value.dailyCardId, isName) &&
  typeof value.repeat === 'boolean' &&
  isNames(value.suggestedCardIds) &&
  isNames(value.countedCardIds) &&
  isMoment(value.updatedAt)

const isQuestions = (value: unknown): boolean =>
  isNames(value) && value.length >= 1 && value.length <= OWN_QUESTIONS_MAX && value.every((question) => question.length <= QUESTION_MAX)

const isWeekendItem = (value: unknown): value is WeekendItem =>
  isRecord(value) &&
  isName(value.id) &&
  isName(value.title) &&
  isMoment(value.addedAt) &&
  isMoment(value.updatedAt) &&
  ((value.kind === 'card' && isName(value.cardId) && maybe(value.category, isName)) ||
    (value.kind === 'own' && (value.title as string).length <= TITLE_MAX && isQuestions(value.questions)))

const isSettings = (value: unknown): value is Settings =>
  isRecord(value) && isNames(value.interests) && value.interests.length > 0 && unique(value.interests) && maybe(value.updatedAt, isMoment)

/** Structure only: one bad record, a key used twice or settings without interests, and the whole file is refused. */
export function validateKitData(data: unknown): data is KitData {
  if (!isRecord(data) || !maybe(data.settings, isSettings)) return false
  const { progress, days, weekend } = data
  if (!Array.isArray(progress) || !progress.every(isProgress) || !unique(progress.map((p) => p.cardId))) return false
  if (!Array.isArray(days) || !days.every(isDayLog) || !unique(days.map((day) => day.date))) return false
  return Array.isArray(weekend) && weekend.every(isWeekendItem) && unique(weekend.map((item) => item.id))
}

export const finishedCount = (progress: Iterable<CardProgress>): number => [...progress].filter((p) => p.completedAt).length

export const summarizeKit = (data: KitData): CountLine[] => [
  { key: 'finished', count: finishedCount(data.progress), label: 'biten kart' },
  { key: 'topics', count: data.weekend.length, label: 'konu' },
]

/** An older backup takes the steps an older device's records take (storage/migrations.ts); an unknown version throws. */
export function migrateKit(data: unknown, from: number): unknown {
  if (from === DATA_VERSION) return data
  if (!Number.isInteger(from) || from < 1 || from > DATA_VERSION) throw new Error(`No backup migration from data version ${from}`)
  if (!isRecord(data)) throw new Error('A backup without data')
  const each = (kind: RecordKind, list: unknown) => (Array.isArray(list) ? list.map((record) => migrateRecord(kind, record, from)) : list)
  return {
    ...data,
    progress: each('progress', data.progress),
    days: each('days', data.days),
    weekend: each('weekend', data.weekend),
    ...(data.settings !== undefined && { settings: migrateRecord('settings', data.settings, from) }),
  }
}

/** When anything last changed: the newest stamp of any record (plan 7). */
export function latestChange(data: KitData): string | undefined {
  const stamps = [...data.progress, ...data.days, ...data.weekend].map((record) => record.updatedAt)
  if (data.settings?.updatedAt) stamps.push(data.settings.updatedAt)
  return stamps.reduce<string | undefined>((latest, stamp) => (!latest || stamp > latest ? stamp : latest), undefined)
}

const hasUserData = (data: KitData) => data.progress.length > 0 || data.weekend.length > 0

/** What the device holds right now, as a backup carries it. */
function useKitData(): KitData {
  const { settings, progress, days, weekend } = useAppData()
  return useMemo(() => ({ ...(settings && { settings }), progress: [...progress.values()], days: [...days.values()], weekend }), [settings, progress, days, weekend])
}

/** The adapter reads what is in memory, so the share sheet can open right after the tap. */
export function useKitBackup(): BackupAdapter<KitData> {
  const { reload } = useAppData()
  const data = useKitData()
  return useMemo(
    () => ({
      kit: KIT,
      kitName: KIT_NAME,
      dataVersion: DATA_VERSION,
      appBuild: __BUILD_TIME__,
      exportData: () => data,
      summarize: summarizeKit,
      migrate: migrateKit,
      validate: validateKitData,
      async restore(incoming, mode) {
        const counts = await restoreBackup(incoming, mode)
        await reload()
        return counts
      },
      lastChangeAt: () => latestChange(data),
      hasUserData: () => hasUserData(data),
    }),
    [data, reload],
  )
}

function reminderOf(state: BackupState, data: KitData) {
  return backupDue({ now: new Date(), hasUserData: hasUserData(data), lastChangeAt: latestChange(data), ...state })
}

/** Whether a backup is due, for the home screen's banner and dot and for the settings card. */
export function useBackupReminder() {
  const data = useKitData()
  const [state, setState] = useState(() => readBackupState(KIT))
  const refresh = useCallback(() => setState(readBackupState(KIT)), [])
  const snooze = useCallback(() => {
    snoozeReminder(KIT, new Date())
    setState(readBackupState(KIT))
  }, [])
  return { reminder: reminderOf(state, data), lastBackupAt: state.lastBackupAt, refresh, snooze }
}
