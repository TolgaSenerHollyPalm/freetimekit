import type { CSSProperties } from 'react'
import type { Category } from '../packs/types.ts'

// A category the index does not name yet still gets a colour white text reads on (6.3:1).
const UNKNOWN = '#5E6562'

/** The category's own colour as a CSS variable; the same in both schemes (plan 2.1). */
export const categoryStyle = (category?: Category): CSSProperties => ({ '--category': category?.color ?? UNKNOWN }) as CSSProperties
