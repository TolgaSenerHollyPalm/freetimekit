import { Button } from 'kitshelf-ui/ui/Button.tsx'
import { ArrowRightIcon, CheckIcon } from 'kitshelf-ui/ui/icons.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import { useRef, useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { navigate } from '../app/router.ts'
import { useRestore } from '../backup/useRestore.tsx'
import { welcomeSettings } from '../cards/interests.ts'
import { KIT_NAME } from '../kit.ts'
import { CategoryTile } from '../ui/category.tsx'
import { WifiOffIcon } from '../ui/icons.tsx'
import home from './HomeScreen.module.css'
import styles from './WelcomeScreen.module.css'

/** The first visit, before there are any interests: which categories the day's cards come from (plan 6.1). */
export default function WelcomeScreen() {
  const data = useAppData()
  const restore = useRestore()
  const picker = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<string[]>([])
  const categories = data.index.categories
  const toggle = (id: string) => setChosen((list) => (list.includes(id) ? list.filter((c) => c !== id) : [...list, id]))

  const start = () => {
    if (chosen.length === 0) return
    // In the index's order, so the first interest is the first category.
    data.saveSettings(welcomeSettings(categories.map((c) => c.id).filter((id) => chosen.includes(id))))
    data.syncPacks()
    navigate({ screen: 'home' }, { replace: true })
  }

  return (
    <Screen
      title="Neleri merak edersin?"
      icon={
        <span className={home.brand}>
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
          {KIT_NAME}
        </span>
      }
      footer={
        <Button variant="primary" big disabled={chosen.length === 0} onClick={start}>
          {chosen.length === 0 ? (
            'En az bir alan seç'
          ) : (
            <>
              Başla
              <ArrowRightIcon />
            </>
          )}
        </Button>
      }
    >
      <p className={styles.intro}>Seçtiğin alanlardan her gün bir kart öneririz. Sonra Konular’dan değiştirebilirsin.</p>
      <div className={styles.count}>
        <span>{chosen.length === 0 ? 'Henüz seçim yok' : `${chosen.length} alan seçili`}</span>
        <Button variant="text" inline onClick={() => setChosen(categories.map((c) => c.id))}>
          Hepsini seç
        </Button>
      </div>
      <div className={styles.grid} role="group" aria-label="İlgi alanları">
        {categories.map((category) => {
          const on = chosen.includes(category.id)
          return (
            <button key={category.id} type="button" className={on ? `${styles.tile} ${styles.on}` : styles.tile} aria-pressed={on} onClick={() => toggle(category.id)}>
              <span className={styles.top}>
                <CategoryTile id={category.id} category={category} size="small" />
                <span className={styles.mark} aria-hidden="true">
                  {on && <CheckIcon size={14} strokeWidth={3} />}
                </span>
              </span>
              <span className={styles.name}>{category.label}</span>
              <span className={styles.description}>{category.description}</span>
            </button>
          )
        })}
      </div>
      <p className={styles.note}>
        <WifiOffIcon />
        Kartlar internet varken iner, sonra internetsiz de açılır.
      </p>
      <button type="button" className={styles.restore} onClick={() => picker.current?.click()}>
        Yedeğin var mı? Geri yükle
      </button>
      {/* As on the settings card: no accept filter, reading the file checks it instead. */}
      <input
        ref={picker}
        type="file"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) restore.open(file)
        }}
      />
      {/* Restored settings make the home screen show instead of this one. */}
      {restore.dialogs}
    </Screen>
  )
}
