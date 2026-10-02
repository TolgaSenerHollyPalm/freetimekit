import { Button } from 'kitshelf-ui/ui/Button.tsx'
import ConfirmDialog from 'kitshelf-ui/ui/ConfirmDialog.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { href, navigate } from '../app/router.ts'
import { hasQuiz, notesByTopic, shareText, standings } from '../cards/table.ts'
import type { TableSession } from '../cards/types.ts'
import styles from './TableDoneScreen.module.css'

/** Masa bitti: the ranking and the notes, to share; then the list can be cleared (plan 6.10). */
export default function TableDoneScreen() {
  const { table, weekend, saveTable, clearWeekend } = useAppData()
  const session = table as TableSession
  const [confirming, setConfirming] = useState(false)
  const notes = notesByTopic(session)
  const taken = session.topics.map((topic) => topic.id).filter((id) => weekend.some((item) => item.id === id))
  const canShare = typeof navigator.share === 'function'

  return (
    <Screen
      title="Masa bitti"
      back={href({ screen: 'home' })}
      footer={
        <Button
          variant="primary"
          big
          onClick={() => {
            saveTable(undefined)
            navigate({ screen: 'home' }, { replace: true })
          }}
        >
          Bitir
        </Button>
      }
    >
      <h2 className={text.sectionTitle}>Sıralama</h2>
      {hasQuiz(session) ? (
        <ol className={styles.ranking}>
          {standings(session).map((row) => (
            <li key={row.player.id} className={row.rank === 1 ? `${styles.row} ${styles.first}` : styles.row}>
              <span className={styles.who}>
                {row.rank}. {row.player.name}
              </span>
              <span className={styles.points}>{row.points} puan</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className={text.hint}>Bu masada bilgi sorusu yoktu.</p>
      )}

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Notlar</h2>
      {notes.length === 0 ? (
        <p className={text.hint}>Not yazılmadı.</p>
      ) : (
        notes.map(({ topic, notes: lines }) => (
          <section key={topic.id} className={styles.topic}>
            <h3 className={styles.topicTitle}>{topic.title}</h3>
            {lines.map((line, i) => (
              <div key={i} className={styles.note}>
                <p className={styles.question}>{line.question}</p>
                <p>{line.text}</p>
              </div>
            ))}
          </section>
        ))
      )}

      <div className={styles.actions}>
        {canShare && (
          <Button onClick={() => navigator.share({ text: shareText(session) }).catch(() => undefined)}>Notları paylaş</Button>
        )}
        {taken.length > 0 && <Button onClick={() => setConfirming(true)}>Listeyi temizle</Button>}
      </div>

      <ConfirmDialog
        open={confirming}
        title="Masaya alınan konular listeden silinsin mi?"
        confirmLabel="Evet, temizle"
        onConfirm={() => {
          setConfirming(false)
          clearWeekend(taken)
        }}
        onCancel={() => setConfirming(false)}
      >
        Hafta sonu listesindeki {taken.length} konu silinecek.
      </ConfirmDialog>
    </Screen>
  )
}
