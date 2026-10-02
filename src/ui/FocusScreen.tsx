import type { ReactNode } from 'react'
import { IconLink } from 'kitshelf-ui/ui/IconButton.tsx'
import { ExitIcon } from './icons.tsx'
import styles from './FocusScreen.module.css'

interface FocusScreenProps {
  title: string // centred in the bar, e.g. "Soru 2 / 3"
  close: { to: string; label: string } // the way out, e.g. back to the card
  under?: ReactNode // right under the bar, e.g. the progress bar
  footer?: ReactNode // the one main action, fixed at the bottom
  children: ReactNode
}

/** A screen for one task at a time: a way out on the left, where you are in the middle. */
export default function FocusScreen({ title, close, under, footer, children }: FocusScreenProps) {
  return (
    <div className={styles.screen}>
      <header className={styles.bar}>
        <IconLink to={close.to} label={close.label}>
          <ExitIcon />
        </IconLink>
        <h1 className={styles.title}>{title}</h1>
        <span aria-hidden="true" />
      </header>
      {under && <div className={styles.under}>{under}</div>}
      <main className={styles.content}>{children}</main>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  )
}
