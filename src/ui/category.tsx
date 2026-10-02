import type { Category } from '../packs/types.ts'
import styles from './category.module.css'
import { categoryStyle } from './categoryStyle.ts'
import { CategoryIcon } from './icons.tsx'

const ICON_SIZE = { list: 22, small: 21, round: 18, big: 26 }

/** The coloured square with the category's white icon: list rows, the welcome's tiles, the topic chips. */
export function CategoryTile({ id, category, size = 'list' }: { id: string; category?: Category; size?: keyof typeof ICON_SIZE }) {
  return (
    <span className={`${styles.tile} ${styles[size]}`} style={categoryStyle(category)} aria-hidden="true">
      <CategoryIcon id={id} size={ICON_SIZE[size]} />
    </span>
  )
}

/** A pill in the category's colour with its name, and its icon unless `plain`. */
export function CategoryBadge({ id, category, label, plain }: { id: string; category?: Category; label?: string; plain?: boolean }) {
  return (
    <span className={plain ? `${styles.badge} ${styles.plain}` : styles.badge} style={categoryStyle(category)}>
      {!plain && <CategoryIcon id={id} size={14} strokeWidth={2} />}
      {label ?? category?.label ?? id}
    </span>
  )
}
