import type { Settings } from './types.ts'

export const LAST_INTEREST = 'En az bir ilgi alanı seçili kalmalı.'

/** The interests with one added or taken off; the last one cannot go. */
export function toggleInterest(interests: readonly string[], id: string): { interests: string[] } | { problem: string } {
  if (!interests.includes(id)) return { interests: [...interests, id] }
  if (interests.length === 1) return { problem: LAST_INTEREST }
  return { interests: interests.filter((interest) => interest !== id) }
}

/** What the welcome saves: not stamped, so a backup's settings win when it is merged in (plan 6.1). */
export const welcomeSettings = (interests: readonly string[]): Settings => ({ interests: [...interests] })

/** Interests changed on the Topics screen: stamped. */
export const editedSettings = (interests: readonly string[], now: Date): Settings => ({ interests: [...interests], updatedAt: now.toISOString() })
