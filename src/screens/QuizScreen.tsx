import { Button } from 'kitshelf-ui/ui/Button.tsx'
import { ArrowRightIcon } from 'kitshelf-ui/ui/icons.tsx'
import Missing from 'kitshelf-ui/ui/Missing.tsx'
import ProgressBar from 'kitshelf-ui/ui/ProgressBar.tsx'
import { useEffect, useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { href, navigate } from '../app/router.ts'
import { categoryOf } from '../cards/library.ts'
import { nextQuestion } from '../cards/progress.ts'
import { CategoryBadge } from '../ui/category.tsx'
import FocusScreen from '../ui/FocusScreen.tsx'
import { Options, Verdict } from '../ui/Options.tsx'
import styles from './QuizScreen.module.css'

const NEXT = 'quiz-next'

/** The card's questions one at a time; an answered one is never asked again (plan 6.4). */
export default function QuizScreen({ cardId }: { cardId: string }) {
  const { library, progress, answer } = useAppData()
  const card = library.cards.get(cardId)
  const record = progress.get(cardId)
  // Fixed while the screen is open: an answered question stays in view until "Sonraki soru".
  const [index, setIndex] = useState(() => (card ? (nextQuestion(card, record) ?? 0) : 0))
  // A card is solved once; opened again, its answers are what there is to see.
  const [solvedBefore] = useState(() => Boolean(record?.completedAt))
  useEffect(() => {
    if (solvedBefore) navigate({ screen: 'answers', cardId }, { replace: true })
  }, [solvedBefore, cardId])
  const question = card?.questions[index]
  const chosen = question ? record?.answers[question.id] : undefined

  // After an answer the result is read out and the way on gets the focus.
  useEffect(() => {
    if (chosen !== undefined) document.getElementById(NEXT)?.focus()
  }, [chosen])

  if (solvedBefore) return null
  if (!card || !question) return <Missing message="Bu kart bulunamadı." back={href({ screen: 'home' })} />
  const category = categoryOf(library, card.id)
  const answered = card.questions.filter((q) => record?.answers[q.id] !== undefined).length
  const last = index === card.questions.length - 1

  const onward = () => {
    if (last) navigate({ screen: 'done', cardId }, { replace: true })
    else setIndex(nextQuestion(card, progress.get(cardId)) ?? index + 1)
  }

  return (
    <FocusScreen
      title={`Soru ${index + 1} / ${card.questions.length}`}
      close={{ to: href({ screen: 'card', cardId }), label: 'Sorulardan çık' }}
      under={<ProgressBar value={answered} max={card.questions.length} tone="teal" label="Cevaplanan sorular" />}
      footer={
        chosen !== undefined && (
          <Button id={NEXT} variant="primary" big onClick={onward}>
            {last ? (
              'Bitir'
            ) : (
              <>
                Sonraki soru
                <ArrowRightIcon />
              </>
            )}
          </Button>
        )
      }
    >
      <section className={styles.question}>
        <span className={styles.meta}>
          <CategoryBadge id={category?.id ?? ''} category={category} plain />
          <span className={styles.cardName}>{card.title}</span>
        </span>
        <p className={styles.text}>{question.text}</p>
      </section>
      <Options question={question} chosen={chosen} onChoose={(option) => answer(cardId, question.id, option)} />
      <div aria-live="polite">{chosen !== undefined && <Verdict question={question} chosen={chosen} />}</div>
    </FocusScreen>
  )
}
