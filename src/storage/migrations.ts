/** The shape of the stored data: the IndexedDB version, and a backup's dataVersion. */
export const DATA_VERSION = 1

/** The records a backup carries and the database keeps, each with its own steps. */
export type RecordKind = 'progress' | 'days' | 'weekend' | 'settings'

type Step = (record: Record<string, unknown>) => Record<string, unknown>
type Steps = Partial<Record<RecordKind, Record<number, Step>>>

// One step per version, oldest first: STEPS.kind[n] turns a record of version n into one of version n + 1.
// The database upgrade and a backup's import both run them, so an old backup opens like an old device.
const STEPS: Steps = {}

/** Brings a record stored under an older version up to date; throws for a version with no way forward. */
export function migrateRecord<T>(kind: RecordKind, record: unknown, from: number, steps: Steps = STEPS, to = DATA_VERSION): T {
  if (!Number.isInteger(from) || from < 1 || from > to) throw new Error(`No migration from data version ${from}`)
  let current = record as Record<string, unknown>
  for (let version = from; version < to; version++) {
    const step = steps[kind]?.[version]
    if (!step) throw new Error(`No migration of ${kind} from data version ${version}`)
    current = step(current)
  }
  return current as T
}
