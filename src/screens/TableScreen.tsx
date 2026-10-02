import { Button } from 'kitshelf-ui/ui/Button.tsx'
import { IconButton } from 'kitshelf-ui/ui/IconButton.tsx'
import { ArrowRightIcon, RefreshIcon } from 'kitshelf-ui/ui/icons.tsx'
import Menu from 'kitshelf-ui/ui/Menu.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useEffect, useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { href, navigate } from '../app/router.ts'
import { answerStep, clock, initial, nextLabel, noteKey, stepLabel, tablePoints, TIMER_SECONDS, topicOf } from '../cards/table.ts'
import type { TableSession } from '../cards/types.ts'
import { Options } from '../ui/Options.tsx'
import { PauseIcon, PlayIcon } from '../ui/icons.tsx'
import styles from './TableScreen.module.css'

const NEXT = 'table-next'

/** The optional three minutes for a discussion: start, pause, reset; only "Süre doldu." is read out. */
function Timer() {
  const [left, setLeft] = useState(TIMER_SECONDS)
  const [running, setRunning] = useState(false)
  useEffect(() => {
    if (!running) return undefined
    const timer = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [running])
  const over = left === 0
  return (
    <section className={styles.timer}>
      <span className={styles.timerLines}>
        <span className={styles.clock} aria-hidden="true">
          {clock(left)}
        </span>
        <span className={styles.timerNote} aria-live="polite">
          {over ? 'Süre doldu.' : 'Süre isteğe bağlı'}
        </span>
      </span>
      <span className={styles.timerButtons}>
        {left !== TIMER_SECONDS && (
          <IconButton
            label="Süreyi sıfırla"
            onClick={() => {
              setRunning(false)
              setLeft(TIMER_SECONDS)
            }}
          >
            <RefreshIcon />
          </IconButton>
        )}
        {!over && (
          <button type="button" className={styles.play} aria-label={running ? 'Süreyi duraklat' : 'Süreyi başlat'} onClick={() => setRunning((r) => !r)}>
            {running ? <PauseIcon /> : <PlayIcon />}
          </button>
        )}
      </span>
    </section>
  )
}

/** Hafta sonu masası: the phone goes round; quiz questions earn a point, discussion questions none (plan 6.9). */
export default function TableScreen() {
  const { table, saveTable } = useAppData()
  const session = table as TableSession
  const step = session.steps[session.position]
  const topic = topicOf(session, step.topicId)
  const points = tablePoints(session)
  const question = step.kind === 'quiz' ? topic.questions.find((q) => q.id === step.questionId) : undefined
  const answer = step.kind === 'quiz' ? session.answers[step.questionId] : undefined
  const player = step.kind === 'quiz' ? session.players.find((p) => p.id === step.playerId) : undefined
  const note = step.kind === 'discussion' ? noteKey(topic.id, step.index) : undefined

  // After an answer the result is read out and the way on gets the focus.
  useEffect(() => {
    if (answer) document.getElementById(NEXT)?.focus()
  }, [answer])

  const finish = () => {
    saveTable({ ...session, finishedAt: new Date().toISOString() })
    navigate({ screen: 'table-done' }, { replace: true })
  }
  const onward = () => {
    if (session.position >= session.steps.length - 1) return finish()
    saveTable({ ...session, position: session.position + 1 })
    window.scrollTo(0, 0)
  }

  return (
    <Screen
      title="Hafta sonu masası"
      subtitle={topic.title}
      back={href({ screen: 'home' })}
      aside={<Menu label="Masa menüsü" items={[{ label: 'Masayı bitir', onSelect: finish }]} />}
      footer={
        <Button id={NEXT} variant="primary" big onClick={onward}>
          {nextLabel(session)}
          {session.position < session.steps.length - 1 && <ArrowRightIcon />}
        </Button>
      }
    >
      <ul className={styles.scores} aria-label="Puanlar">
        {session.players.map((p) => (
          <li key={p.id} className={p.id === player?.id ? `${styles.score} ${styles.turn}` : styles.score}>
            <span className={styles.initial} aria-hidden="true">
              {initial(p.name)}
            </span>
            <span className={styles.name} title={p.name}>
              {p.name}
            </span>
            <span className={styles.points}>{points[p.id]} puan</span>
          </li>
        ))}
      </ul>

      <section className={styles.step}>
        <span className={styles.stepChip}>{stepLabel(session)}</span>
        {step.kind === 'quiz' && question ? (
          <>
            <p className={styles.turnLine}>Sıra: {player?.name}</p>
            <p className={styles.quizText}>{question.text}</p>
          </>
        ) : (
          <>
            <p className={styles.discussionText}>{topic.discussion[step.kind === 'discussion' ? step.index : 0]}</p>
            <p className={text.hint}>Puan yok; sadece sohbet.</p>
          </>
        )}
      </section>

      {step.kind === 'quiz' && question && (
        <>
          <Options question={question} chosen={answer?.choice} onChoose={(choice) => saveTable(answerStep(session, choice))} />
          <div aria-live="polite">
            {answer && (
              <section className={styles.result}>
                <strong className={answer.correct ? styles.yes : styles.no}>{answer.correct ? `+1 puan ${player?.name}` : `Doğru cevap: ${question.options[question.answerIndex]}`}</strong>
                <p>{question.explanation}</p>
              </section>
            )}
          </div>
        </>
      )}

      {step.kind === 'discussion' && note && (
        <>
          <Timer key={note} />
          <label className={styles.note}>
            <span className={styles.noteLabel}>Ne sonuca vardık?</span>
            <textarea rows={4} value={session.notes[note] ?? ''} onChange={(e) => saveTable({ ...session, notes: { ...session.notes, [note]: e.target.value } })} />
          </label>
        </>
      )}
    </Screen>
  )
}
