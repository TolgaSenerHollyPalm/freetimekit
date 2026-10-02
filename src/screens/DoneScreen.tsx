import { Button, LinkButton } from 'kitshelf-ui/ui/Button.tsx'
import { CheckIcon, ChevronRightIcon, PlusIcon } from 'kitshelf-ui/ui/icons.tsx'
import Missing from 'kitshelf-ui/ui/Missing.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { fullDayName, shortDayName } from '../cards/dates.ts'
import { categoryOf } from '../cards/library.ts'
import { lastWeek, scoreOf, streak, streakText } from '../cards/progress.ts'
import { hasCard } from '../cards/weekend.ts'
import { CategoryBadge } from '../ui/category.tsx'
import FocusScreen from '../ui/FocusScreen.tsx'
import { BoltIcon, ChatIcon, ExitIcon } from '../ui/icons.tsx'
import styles from './DoneScreen.module.css'

/** After a card's last question: the streak, the week, the score and what was learned (plan 6.5). */
export default function DoneScreen({ cardId }: { cardId: string }) {
  const { library, progress, days, today, todayLog, weekend, toggleWeekend } = useAppData()
  const card = library.cards.get(cardId)
  if (!card) return <Missing message="Bu kart bulunamadı." back={href({ screen: 'home' })} />
  const category = categoryOf(library, card.id)
  const score = scoreOf(card, progress.get(cardId))
  const wrong = score.answered - score.correct
  const count = streak(days, today)
  const listed = hasCard(weekend, card.id)

  return (
    <FocusScreen
      title="Günün sonu"
      close={{ to: href({ screen: 'home' }), label: 'Kapat' }}
      footer={
        <LinkButton to={href({ screen: 'home' })} variant="primary" big>
          Bitir
        </LinkButton>
      }
    >
      <section className={styles.streak}>
        <span className={styles.bolt} aria-hidden="true">
          <BoltIcon size={30} strokeWidth={2} />
        </span>
        <span className={styles.streakLines}>
          <span className={styles.streakText}>{streakText(count) ?? 'Seri başladı'}</span>
          <span className={styles.streakNote}>{todayLog?.dailyCardId === card.id ? 'Bugünün kartını bitirdin.' : 'Bu kartı bitirdin.'}</span>
        </span>
      </section>

      <ol className={styles.week} aria-label="Son 7 gün">
        {lastWeek(days, today).map(({ day, done }) => {
          const isToday = day === today
          return (
            <li key={day} aria-label={`${fullDayName(day)}${isToday ? ', bugün' : ''}: ${done ? 'tamamlandı' : 'yapılmadı'}`}>
              <span aria-hidden="true" className={isToday ? `${styles.dayName} ${styles.today}` : styles.dayName}>
                {shortDayName(day)}
              </span>
              <span aria-hidden="true" className={[styles.dot, done && styles.done, isToday && styles.ring].filter(Boolean).join(' ')}>
                {done && <CheckIcon size={16} strokeWidth={2.6} />}
              </span>
            </li>
          )
        })}
      </ol>

      <section className={styles.score}>
        <div className={styles.scoreTop}>
          <span className={styles.scoreLines}>
            <span className={styles.scoreLabel}>Bilgi soruları</span>
            <span className={styles.scoreValue}>
              <span className={styles.scoreNumber}>
                {score.correct} / {score.answered}
              </span>
              doğru
            </span>
          </span>
          <span className={styles.marks} aria-hidden="true">
            {score.marks.map((right, i) => (
              <span key={i} className={right ? styles.yes : styles.no}>
                {right ? <CheckIcon size={16} strokeWidth={2.6} /> : <ExitIcon size={14} strokeWidth={2.4} />}
              </span>
            ))}
          </span>
        </div>
        {wrong > 0 ? (
          <a className={styles.wrongLink} href={href({ screen: 'answers', cardId })}>
            {wrong === 1 ? 'Yanlış cevabını gör' : 'Yanlış cevaplarını gör'}
            <ChevronRightIcon />
          </a>
        ) : (
          <p className={styles.allRight}>Hepsini doğru bildin.</p>
        )}
      </section>

      <div className={styles.learnedHead}>
        <h2 className={text.sectionTitle}>Bugün öğrendiklerin</h2>
        <CategoryBadge id={category?.id ?? ''} category={category} label={card.title} />
      </div>
      <ul className={styles.learned}>
        {card.facts.map((fact, i) => (
          <li key={i}>
            <span className={styles.tick} aria-hidden="true">
              <CheckIcon size={13} strokeWidth={2.8} />
            </span>
            <p>{fact}</p>
          </li>
        ))}
      </ul>

      <section className={styles.discussion}>
        <span className={styles.chat} aria-hidden="true">
          <ChatIcon />
        </span>
        <span className={styles.discussionLines}>
          <strong>{card.discussion.length} tartışma sorusu</strong>
          <span>Hafta sonu masası için</span>
        </span>
        <Button variant="tonal" inline aria-pressed={listed} onClick={() => toggleWeekend(card)}>
          {listed ? <CheckIcon size={16} strokeWidth={2.6} /> : <PlusIcon size={16} strokeWidth={2.4} />}
          {listed ? 'Listende' : 'Ekle'}
        </Button>
      </section>
    </FocusScreen>
  )
}
