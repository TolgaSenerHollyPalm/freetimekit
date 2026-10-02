import { Button } from 'kitshelf-ui/ui/Button.tsx'
import { CheckIcon, DownloadIcon } from 'kitshelf-ui/ui/icons.tsx'
import ProgressBar from 'kitshelf-ui/ui/ProgressBar.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useOnline } from 'kitshelf-ui/ui/useOnline.ts'
import { useState, type ReactNode } from 'react'
import { useAppData, type AppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { editedSettings, toggleInterest } from '../cards/interests.ts'
import type { Category } from '../packs/types.ts'
import { CategoryTile } from '../ui/category.tsx'
import styles from './TopicsScreen.module.css'

interface Row {
  line: string
  side?: ReactNode
  bar?: ReactNode
}

/** What one category's row says about its packs (plan 6.11). */
function packRow(category: Category, data: AppData, online: boolean, download: () => void): Row {
  const entries = data.index.packs.filter((entry) => entry.category === category.id)
  const local = new Map(data.packs.map((pack) => [pack.id, pack.version]))
  const have = entries.filter((entry) => local.has(entry.id))
  const waiting = entries.filter((entry) => (local.get(entry.id) ?? 0) < entry.version)
  const cards = data.library.byCategory.get(category.id) ?? []
  const fresh = cards.filter((card) => !data.progress.has(card.id)).length
  const state = data.sync.categories[category.id]
  const button = (label: string) =>
    online ? (
      <Button variant="tonal" inline aria-label={`${category.label} paketini indir`} onClick={download}>
        <DownloadIcon />
        {label}
      </Button>
    ) : (
      <Button variant="tonal" inline disabled>
        İnternet yok
      </Button>
    )

  if (state?.state === 'downloading') {
    const share = state.total > 1 ? state.done / state.total : state.fraction
    const coming = entries.filter((entry) => waiting.includes(entry)).reduce((sum, entry) => sum + entry.cards, 0)
    return {
      line: `Yeni paket iniyor · ${coming} kart`,
      side: share !== undefined && <span className={styles.percent}>%{Math.round(share * 100)}</span>,
      bar:
        share !== undefined ? (
          <ProgressBar value={Math.round(share * 100)} max={100} tone="teal" label={`${category.label} paketleri iniyor`} />
        ) : (
          <span className={styles.busy} role="progressbar" aria-label={`${category.label} paketleri iniyor`} />
        ),
    }
  }
  if (state?.state === 'failed') return { line: 'İndirilemedi', side: online ? <Button variant="tonal" inline onClick={download}>Tekrar dene</Button> : button('') }
  if (have.length === 0) return { line: `İndirilmedi · ${entries.length} paket, ${entries.reduce((sum, e) => sum + e.cards, 0)} kart`, side: button('İndir') }
  if (have.length < entries.length) return { line: `${have.length} / ${entries.length} paket indirildi`, side: button('İndir') }
  if (waiting.length > 0 && !online) return { line: 'Yeni paket var; internete bağlanınca iner.' }
  return {
    line: `${have.length} paket · ${cards.length} kart · ${fresh > 0 ? `${fresh} yeni` : 'hepsini gördün'}`,
    side: (
      <span className={styles.current}>
        <CheckIcon size={18} strokeWidth={2.6} />
        Güncel
      </span>
    ),
  }
}

/** Konular ve paketler: the interests, and every category's packs with their state (plan 6.11). */
export default function TopicsScreen() {
  const data = useAppData()
  const online = useOnline()
  const [problem, setProblem] = useState<string>()
  const categories = data.index.categories
  // A restored backup may name a category this device's index does not know yet; it counts once the index does.
  const interests = (data.settings?.interests ?? []).filter((id) => categories.some((c) => c.id === id))

  const toggle = (id: string) => {
    const result = toggleInterest(interests, id)
    if ('problem' in result) return setProblem(result.problem)
    setProblem(undefined)
    // Kept in the index's order, so the first interest is the first category.
    data.saveSettings(editedSettings(categories.map((c) => c.id).filter((c) => result.interests.includes(c)), new Date()))
    // A new interest's packs come down at once when there is a connection (plan 5.6).
    if (!interests.includes(id)) data.syncPacks()
  }

  return (
    <Screen title="Konular ve paketler" subtitle="Kartlar internet varken iner, sonra internetsiz açılır." back={href({ screen: 'home' })}>
      <div className={styles.head}>
        <h2 className={text.sectionTitle}>İlgi alanların</h2>
        <span className={styles.count}>
          {interests.length} / {categories.length}
        </span>
      </div>
      <div className={styles.chips} role="group" aria-label="İlgi alanların">
        {categories.map((category) => {
          const on = interests.includes(category.id)
          return (
            <button key={category.id} type="button" className={on ? `${styles.chip} ${styles.on}` : styles.chip} aria-pressed={on} onClick={() => toggle(category.id)}>
              <CategoryTile id={category.id} category={category} size="round" />
              {category.label}
              {on && <CheckIcon size={18} strokeWidth={2.4} />}
            </button>
          )
        })}
      </div>
      <p className={problem ? text.problem : text.hint} role={problem ? 'alert' : undefined}>
        {problem ?? '“Senin için seçtik” kartları bu alanlardan gelir.'}
      </p>

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Paketler</h2>
      <ul className={styles.packs}>
        {categories.map((category) => {
          const row = packRow(category, data, online, () => data.syncPacks([category.id]))
          return (
            <li key={category.id} className={styles.pack}>
              <CategoryTile id={category.id} category={category} />
              <span className={styles.lines}>
                <span className={styles.name}>{category.label}</span>
                <span className={styles.line}>{row.line}</span>
                {row.bar}
              </span>
              {row.side && <span className={styles.side}>{row.side}</span>}
            </li>
          )
        })}
      </ul>
      <p className={text.hint}>İlgi alanlarının yeni paketleri internet varken kendiliğinden iner. Diğerlerini istediğinde indirirsin.</p>
    </Screen>
  )
}
