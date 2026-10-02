import { createContext, useContext } from 'react'
import type { Library } from '../cards/library.ts'
import type { CardProgress, Day, DayLog, Settings, TableSession, WeekendItem } from '../cards/types.ts'
import type { Card, Pack, PackIndex } from '../packs/types.ts'

/** One category's downloads in this sync: files done of total, and the bytes of a lone file when they are known. */
export type CategorySync = { state: 'idle' } | { state: 'downloading'; done: number; total: number; fraction?: number } | { state: 'failed' }

export interface SyncStatus {
  running: boolean
  failed: boolean // the last try could not reach the packs at all
  categories: Record<string, CategorySync>
}

export interface AppData {
  index: PackIndex // the server's newer one once it arrived, else the copy inside the app
  packs: Pack[]
  library: Library
  settings?: Settings // absent until the first-run welcome is answered
  progress: Map<string, CardProgress>
  days: Map<Day, DayLog>
  today: Day
  todayLog?: DayLog // absent until there are settings
  weekend: WeekendItem[]
  table?: TableSession
  sync: SyncStatus
  /** Stores the settings as they are; welcomeSettings and editedSettings decide their stamps. */
  saveSettings: (settings: Settings) => void
  /** Records the card as opened; on a repeat day, opening the day's card makes the day count. */
  openCard: (cardId: string) => void
  /** Keeps one answer; the last one completes the card and makes the day count. */
  answer: (cardId: string, questionId: string, choice: number) => void
  toggleWeekend: (card: Card) => void
  addOwnTopic: (title: string, questions: string[]) => void
  editOwnTopic: (id: string, title: string, questions: string[]) => void
  /** Takes the row off and returns the way to put it back. */
  removeWeekend: (id: string) => () => void
  clearWeekend: (ids: readonly string[]) => void
  /** The table as it is now; undefined removes it. */
  saveTable: (session: TableSession | undefined) => void
  /** Downloads the packs that come by themselves, and every pack of the given categories. */
  syncPacks: (categories?: readonly string[]) => void
  /** Reads everything from IndexedDB again, e.g. after a backup was restored, then syncs the packs. */
  reload: () => Promise<void>
}

export const AppDataContext = createContext<AppData | null>(null)

export function useAppData(): AppData {
  const data = useContext(AppDataContext)
  if (!data) throw new Error('useAppData must be used inside <AppDataProvider>')
  return data
}
