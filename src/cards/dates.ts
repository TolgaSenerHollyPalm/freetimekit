import type { Day } from './types.ts'

const pad = (n: number) => String(n).padStart(2, '0')

/** The device's own calendar day: the day changes at local midnight. */
export const toDay = (date: Date): Day => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

export const today = (now = new Date()): Day => toDay(now)

// Midday keeps a daylight saving shift from moving the date.
const fromDay = (day: Day): Date => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}

export function addDays(day: Day, days: number): Day {
  const date = fromDay(day)
  date.setDate(date.getDate() + days)
  return toDay(date)
}

/** Whole days from `from` to `to`; negative when `to` is earlier. */
export const daysBetween = (from: Day, to: Day): number => Math.round((Date.UTC(...ymd(to)) - Date.UTC(...ymd(from))) / 86_400_000)

function ymd(day: Day): [number, number, number] {
  const [y, m, d] = day.split('-').map(Number)
  return [y, m - 1, d]
}

const weekday = new Intl.DateTimeFormat('tr-TR', { weekday: 'long' })
const dayAndMonth = new Intl.DateTimeFormat('tr-TR', { day: 'numeric', month: 'long' })

/** "Salı, 29 Eylül": the ready-made format would say "29 Eylül Salı". */
export function dayTitle(day: Day): string {
  const date = fromDay(day)
  const parts = dayAndMonth.formatToParts(date)
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? ''
  return `${weekday.format(date)}, ${part('day')} ${part('month')}`
}

export const fullDayName = (day: Day): string => weekday.format(fromDay(day))

const SHORT = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt']
export const shortDayName = (day: Day): string => SHORT[fromDay(day).getDay()]

/** The last `count` days up to and including `last`, oldest first. */
export const lastDays = (last: Day, count = 7): Day[] => Array.from({ length: count }, (_, i) => addDays(last, i - count + 1))
