import { Button, LinkButton } from 'kitshelf-ui/ui/Button.tsx'
import ConfirmDialog from 'kitshelf-ui/ui/ConfirmDialog.tsx'
import { IconButton } from 'kitshelf-ui/ui/IconButton.tsx'
import { PlusIcon } from 'kitshelf-ui/ui/icons.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { href, navigate } from '../app/router.ts'
import { MAX_PLAYERS, NAME_MAX, playerProblems, startTable, tableTopics } from '../cards/table.ts'
import { KEYS } from '../kit.ts'
import { ExitIcon } from '../ui/icons.tsx'
import styles from './TableSetupScreen.module.css'

function lastPlayers(): string[] {
  try {
    const names: unknown = JSON.parse(localStorage.getItem(KEYS.lastPlayers) ?? '[]')
    return Array.isArray(names) ? names.filter((n): n is string => typeof n === 'string').slice(0, MAX_PLAYERS) : []
  } catch {
    return []
  }
}

/** Masayı kur: who is playing, and what the table will take from the list (plan 6.8). */
export default function TableSetupScreen() {
  const { library, weekend, table, saveTable } = useAppData()
  const [names, setNames] = useState<string[]>(() => {
    const kept = lastPlayers()
    return kept.length >= 2 ? kept : [...kept, '', ''].slice(0, 2)
  })
  const [tried, setTried] = useState(false)
  const [replacing, setReplacing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const { topics, skipped } = tableTopics(weekend, library.cards)
  const problems = playerProblems(names)
  const questions = topics.reduce((sum, t) => sum + t.questions.length, 0)
  const discussions = topics.reduce((sum, t) => sum + t.discussion.length, 0)

  if (table && !table.finishedAt && !replacing) {
    return (
      <Screen title="Masayı kur" back={href({ screen: 'weekend' })}>
        <p className={styles.pending}>Yarım kalan bir masa var.</p>
        <LinkButton to={href({ screen: 'table' })} variant="primary">
          Masaya dön
        </LinkButton>
        <Button onClick={() => setConfirming(true)}>Yeni masa kur</Button>
        <ConfirmDialog
          open={confirming}
          title="Yarım kalan masa silinsin mi?"
          confirmLabel="Evet, sil"
          onConfirm={() => {
            setConfirming(false)
            saveTable(undefined)
            setReplacing(true)
          }}
          onCancel={() => setConfirming(false)}
        >
          Masadaki puanlar ve notlar silinecek.
        </ConfirmDialog>
      </Screen>
    )
  }

  const start = () => {
    setTried(true)
    if (problems.list || problems.fields.some(Boolean) || topics.length === 0) return
    const session = startTable(names, topics, new Date())
    saveTable(session)
    try {
      localStorage.setItem(KEYS.lastPlayers, JSON.stringify(session.players.map((p) => p.name)))
    } catch {
      // Without storage the names are simply not offered next time.
    }
    navigate({ screen: 'table' }, { replace: true })
  }

  return (
    <Screen
      title="Masayı kur"
      back={href({ screen: 'weekend' })}
      footer={
        <Button variant="primary" big disabled={topics.length === 0} onClick={start}>
          Başlat
        </Button>
      }
    >
      <h2 className={text.sectionTitle}>Kimler oynuyor?</h2>
      <ol className={styles.players}>
        {names.map((name, i) => (
          <li key={i} className={styles.player}>
            <label className={styles.field}>
              <span className={text.visuallyHidden}>Oyuncu {i + 1}</span>
              <input
                value={name}
                maxLength={NAME_MAX}
                placeholder={`Oyuncu ${i + 1}`}
                aria-invalid={tried && Boolean(problems.fields[i])}
                aria-describedby={tried && problems.fields[i] ? `player-${i}-problem` : undefined}
                onChange={(e) => setNames((list) => list.map((n, j) => (j === i ? e.target.value : n)))}
              />
              {tried && problems.fields[i] && (
                <span id={`player-${i}-problem`} className={text.problem}>
                  {problems.fields[i]}
                </span>
              )}
            </label>
            <IconButton label="Oyuncuyu çıkar" onClick={() => setNames((list) => list.filter((_, j) => j !== i))}>
              <ExitIcon />
            </IconButton>
          </li>
        ))}
      </ol>
      {tried && problems.list && <p className={text.problem}>{problems.list}</p>}
      {names.length < MAX_PLAYERS && (
        <Button onClick={() => setNames((list) => [...list, ''])}>
          <PlusIcon size={20} strokeWidth={2.2} />
          Oyuncu ekle
        </Button>
      )}

      <section className={styles.summary}>
        <p className={styles.counts}>
          {topics.length} konu · {questions} bilgi sorusu · {discussions} tartışma sorusu
        </p>
        {skipped > 0 && <p className={text.hint}>{skipped} konu atlandı: kartı bu cihazda yok.</p>}
      </section>
    </Screen>
  )
}
