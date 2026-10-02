import { CheckIcon } from 'kitshelf-ui/ui/icons.tsx'
import type { Question } from '../packs/types.ts'
import { ExitIcon } from './icons.tsx'
import styles from './Options.module.css'

interface OptionsProps {
  question: Question
  chosen?: number // locked once there is one
  onChoose?: (option: number) => void
  tagged?: boolean // the answers screen writes "Doğru cevap" and "Senin cevabın" on the rows too
}

/** The four options: open until one is chosen, then locked with the right one green and a wrong pick red. */
export function Options({ question, chosen, onChoose, tagged }: OptionsProps) {
  const locked = chosen !== undefined
  return (
    <div className={styles.options}>
      {question.options.map((option, index) => {
        const right = locked && index === question.answerIndex
        const wrong = locked && index === chosen && !right
        const state = right ? styles.right : wrong ? styles.wrong : locked ? styles.quiet : ''
        const label = right ? `${option}, doğru cevap` : wrong ? `${option}, senin cevabın` : undefined
        return (
          <button key={index} type="button" className={`${styles.option} ${state}`} disabled={locked} aria-label={label} onClick={() => onChoose?.(index)}>
            <span className={styles.text}>
              {option}
              {tagged && (right || wrong) && (
                <span className={styles.tag} aria-hidden="true">
                  {right ? (index === chosen ? 'Doğru cevap · Senin cevabın' : 'Doğru cevap') : 'Senin cevabın'}
                </span>
              )}
            </span>
            {right && <CheckIcon size={20} strokeWidth={2.6} />}
            {wrong && <ExitIcon size={18} strokeWidth={2.4} />}
          </button>
        )
      })}
    </div>
  )
}

/** "Doğru." or "Yanlış. Doğru cevap: …", then why. */
export function Verdict({ question, chosen }: { question: Question; chosen: number }) {
  const right = chosen === question.answerIndex
  return (
    <section className={styles.verdict}>
      <strong className={right ? styles.yes : styles.no}>{right ? 'Doğru.' : `Yanlış. Doğru cevap: ${question.options[question.answerIndex]}.`}</strong>
      <p>{question.explanation}</p>
    </section>
  )
}
