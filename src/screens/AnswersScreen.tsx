import Missing from 'kitshelf-ui/ui/Missing.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { Options, Verdict } from '../ui/Options.tsx'
import styles from './AnswersScreen.module.css'

/** The card's answered questions, one under the other, as the question screen showed them answered (plan 6.6). */
export default function AnswersScreen({ cardId }: { cardId: string }) {
  const { library, progress } = useAppData()
  const card = library.cards.get(cardId)
  if (!card) return <Missing message="Bu kart bulunamadı." back={href({ screen: 'home' })} />
  const answers = progress.get(cardId)?.answers ?? {}
  const answered = card.questions.filter((question) => answers[question.id] !== undefined)

  return (
    <Screen title="Cevaplar" subtitle={card.title} back={href({ screen: 'card', cardId })}>
      {answered.map((question, i) => (
        <section key={question.id} className={styles.question} aria-label={`Soru ${i + 1}`}>
          <p className={styles.text}>
            <span className={styles.number}>{i + 1}.</span> {question.text}
          </p>
          <Options question={question} chosen={answers[question.id]} tagged />
          <Verdict question={question} chosen={answers[question.id]} />
        </section>
      ))}
    </Screen>
  )
}
