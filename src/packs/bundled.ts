import data from '../../public/packs/index.json'
import type { PackIndex } from './types.ts'
import { validateIndex } from './validate.ts'

let checked: PackIndex | undefined

/** The index that travels inside the app: the first visit and the category names work before the server answers. */
export function bundledIndex(): PackIndex {
  if (checked) return checked
  const result = validateIndex(data)
  // The pack audit test keeps this file valid; a broken copy here is a build mistake, not a user's problem.
  if (!result.ok) throw new Error(`The bundled pack index is invalid: ${result.errors.join(' ')}`)
  checked = result.value
  return checked
}
