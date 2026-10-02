import type { RestoreCount, RestoreMode } from 'kitshelf-ui/backup/format.ts'
import type { CardProgress, DayLog, Settings, WeekendItem } from '../cards/types.ts'
import { mergeDays, mergeProgress, mergeSettings, mergeWeekend } from './merge.ts'

/** What a backup carries. The packs download again and the table in play stays on its device (plan 7). */
export interface KitData {
  settings?: Settings
  progress: CardProgress[]
  days: DayLog[]
  weekend: WeekendItem[]
}

/** The keys of the counts a restore reports; restoredText words them. */
export const COUNT_KEYS = { finished: 'finished', topics: 'topics', days: 'days', settings: 'settings' } as const

export interface RestorePlan {
  clear: boolean // replace: the four are emptied and the table goes first
  progress: CardProgress[] // to write
  days: DayLog[]
  weekend: WeekendItem[]
  settings?: Settings // the settings afterwards; none after replacing with a backup that had none
  counts: RestoreCount[]
}

const finished = (progress: readonly CardProgress[]) => progress.filter((p) => p.completedAt).length

/** What a restore writes, worked out in one go so the transaction never waits between its reads and writes. */
export function planRestore(local: KitData, incoming: KitData, mode: RestoreMode): RestorePlan {
  if (mode === 'replace') {
    const done = finished(incoming.progress)
    return {
      clear: true,
      progress: incoming.progress,
      days: incoming.days,
      weekend: incoming.weekend,
      settings: incoming.settings,
      counts: [
        { key: COUNT_KEYS.finished, label: 'biten kart', added: done, updated: 0, total: done },
        { key: COUNT_KEYS.topics, label: 'konu', added: incoming.weekend.length, updated: 0, total: incoming.weekend.length },
      ],
    }
  }
  const before = new Map(local.progress.map((p) => [p.cardId, p]))
  const progress = mergeProgress(local.progress, incoming.progress)
  const days = mergeDays(local.days, incoming.days)
  const weekend = mergeWeekend(local.weekend, incoming.weekend)
  const settings = mergeSettings(local.settings, incoming.settings)
  // Only what is new or changed: the rest is on the device already, as the very same objects.
  const written = progress.items.filter((p) => before.get(p.cardId) !== p)
  const newlyFinished = written.filter((p) => p.completedAt && !before.get(p.cardId)?.completedAt).length
  return {
    clear: false,
    progress: written,
    days: days.items.filter((day) => !local.days.includes(day)),
    weekend: weekend.items.filter((item) => !local.weekend.includes(item)),
    settings: settings.settings,
    counts: [
      // A card the backup finished counts as added; any other changed card as an updated record.
      { key: COUNT_KEYS.finished, label: 'biten kart', added: newlyFinished, updated: written.length - newlyFinished, total: finished(progress.items) },
      { key: COUNT_KEYS.topics, label: 'konu', added: weekend.added, updated: weekend.updated, total: weekend.items.length },
      { key: COUNT_KEYS.days, label: 'gün', added: days.added, updated: days.updated, total: days.items.length },
      { key: COUNT_KEYS.settings, label: 'ayar', added: 0, updated: settings.changed ? 1 : 0, total: settings.settings ? 1 : 0 },
    ],
  }
}

/** The plan's words for what a restore did (plan 9). */
export function restoredText(counts: readonly RestoreCount[], mode: RestoreMode): string {
  const count = (key: string) => counts.find((c) => c.key === key) ?? { added: 0, updated: 0, total: 0 }
  const cards = count(COUNT_KEYS.finished)
  const topics = count(COUNT_KEYS.topics)
  if (mode === 'replace') return `Geri yüklendi: ${cards.total} biten kart, ${topics.total} konu.`
  const added = [...(cards.added > 0 ? [`${cards.added} biten kart`] : []), ...(topics.added > 0 ? [`${topics.added} konu`] : [])]
  const updated = cards.updated + topics.updated
  const parts = [...(added.length > 0 ? [`${added.join(', ')} eklendi`] : []), ...(updated > 0 ? [`${updated} kayıt güncellendi`] : [])]
  if (parts.length > 0) return `Geri yüklendi: ${parts.join('; ')}.`
  const days = count(COUNT_KEYS.days)
  if (days.added + days.updated + count(COUNT_KEYS.settings).updated > 0) return 'Geri yüklendi: serin ve ayarların güncellendi.'
  return 'Yedekteki her şey bu cihazda zaten var.'
}
