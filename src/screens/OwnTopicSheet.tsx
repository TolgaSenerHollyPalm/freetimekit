import { Button } from 'kitshelf-ui/ui/Button.tsx'
import { IconButton } from 'kitshelf-ui/ui/IconButton.tsx'
import Sheet from 'kitshelf-ui/ui/Sheet.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useState } from 'react'
import type { WeekendItem } from '../cards/types.ts'
import { OWN_QUESTIONS_MAX, QUESTION_MAX, TITLE_MAX, topicProblems } from '../cards/weekend.ts'
import { ExitIcon } from '../ui/icons.tsx'
import styles from './OwnTopicSheet.module.css'

interface OwnTopicSheetProps {
  open: boolean
  item?: WeekendItem // editing this own topic; adding a new one without
  onSave: (title: string, questions: string[]) => void
  onDelete: () => void
  onClose: () => void
}

/** "Kendi konun": a title and up to three discussion questions; a third field appears once the second has text. */
export default function OwnTopicSheet(props: OwnTopicSheetProps) {
  return (
    <Sheet open={props.open} title="Kendi konun" onClose={props.onClose}>
      {/* Remounted at every opening, so a new topic always starts empty. */}
      <Form key={props.item?.id ?? 'new'} {...props} />
    </Sheet>
  )
}

function Form({ item, onSave, onDelete, onClose }: OwnTopicSheetProps) {
  const [title, setTitle] = useState(item?.title ?? '')
  const [questions, setQuestions] = useState<string[]>(() => {
    const start = [...(item?.questions ?? [])]
    while (start.length < 2) start.push('')
    if (start.length < OWN_QUESTIONS_MAX && start.at(-1) !== '') start.push('')
    return start
  })
  const [tried, setTried] = useState(false)
  const problems = topicProblems(title, questions)

  const type = (index: number, value: string) =>
    setQuestions((list) => {
      const next = list.map((q, i) => (i === index ? value : q))
      // The next empty field appears as soon as the last one has text, up to three.
      if (next.length < OWN_QUESTIONS_MAX && next.at(-1)!.trim() !== '') next.push('')
      return next
    })

  const save = () => {
    setTried(true)
    if (problems.title || problems.questions) return
    onSave(title, questions)
  }

  return (
    <div className={styles.form}>
      <span className={styles.close}>
        <IconButton label="Kapat" onClick={onClose}>
          <ExitIcon />
        </IconButton>
      </span>
      <label className={styles.field}>
        <span className={styles.label}>Konu</span>
        <input value={title} maxLength={TITLE_MAX} onChange={(e) => setTitle(e.target.value)} aria-invalid={tried && Boolean(problems.title)} aria-describedby={tried && problems.title ? 'topic-title-problem' : undefined} />
        {tried && problems.title && (
          <span id="topic-title-problem" className={text.problem}>
            {problems.title}
          </span>
        )}
      </label>
      <fieldset className={styles.questions}>
        <legend className={styles.label}>
          Tartışma soruları <span className={styles.quiet}>· en çok 3</span>
        </legend>
        {questions.map((question, i) => (
          <label key={i} className={styles.question}>
            <span className={text.visuallyHidden}>Soru {i + 1}</span>
            <input value={question} maxLength={QUESTION_MAX} placeholder={i === 0 ? undefined : 'Bir soru daha yaz (isteğe bağlı)'} onChange={(e) => type(i, e.target.value)} />
          </label>
        ))}
        {tried && problems.questions && <span className={text.problem}>{problems.questions}</span>}
      </fieldset>
      <div className={styles.buttons}>
        <Button onClick={onClose}>Vazgeç</Button>
        <Button variant="primary" onClick={save}>
          {item ? 'Kaydet' : 'Listeye ekle'}
        </Button>
      </div>
      {item && (
        <Button variant="text" onClick={onDelete}>
          Konuyu sil
        </Button>
      )}
    </div>
  )
}
