import { describe, expect, it } from 'vitest'
import { DATA_VERSION, migrateRecord } from './migrations.ts'

describe('migrateRecord', () => {
  it('passes a record of the current version through as it is', () => {
    const record = { cardId: 'tarih-001' }
    expect(migrateRecord('progress', record, DATA_VERSION)).toBe(record)
  })

  it('refuses a version it has no way forward from', () => {
    for (const from of [0, DATA_VERSION + 1, 1.5, Number.NaN]) expect(() => migrateRecord('days', {}, from)).toThrow('No migration')
  })

  // No real step exists yet; these stand in for the ones later versions will add.
  it('runs every step of the record’s kind between the stored version and the current one', () => {
    const steps = { weekend: { 1: (old: Record<string, unknown>) => ({ ...old, tags: [] }), 2: ({ tags, ...rest }: Record<string, unknown>) => ({ ...rest, labels: tags }) } }
    expect(migrateRecord('weekend', { id: 'x' }, 1, steps, 3)).toEqual({ id: 'x', labels: [] })
    expect(() => migrateRecord('progress', { id: 'x' }, 1, steps, 3)).toThrow('No migration of progress from data version 1')
  })
})
