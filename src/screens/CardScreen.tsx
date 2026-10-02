import { Button, LinkButton } from 'kitshelf-ui/ui/Button.tsx'
import { ArrowRightIcon } from 'kitshelf-ui/ui/icons.tsx'
import Missing from 'kitshelf-ui/ui/Missing.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { Fragment, useEffect } from 'react'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { categoryOf } from '../cards/library.ts'
import { nextQuestion } from '../cards/progress.ts'
import { hasCard } from '../cards/weekend.ts'
import { CategoryBadge } from '../ui/category.tsx'
import { BookmarkCheckIcon, BookmarkPlusIcon, ChatIcon, ClockIcon } from '../ui/icons.tsx'
import styles from './CardScreen.module.css'

/** One card: its short facts and sources, its discussion questions, and the way to its quiz (plan 6.3). */
export default function CardScreen({ cardId }: { cardId: string }) {
  const { library, progress, weekend, openCard, toggleWeekend } = useAppData()
  const card = library.cards.get(cardId)
  const known = card !== undefined

  // Opening the card is what makes it seen, and on a repeat day what makes the day count.
  useEffect(() => {
    if (known) openCard(cardId)
  }, [known, cardId, openCard])

  if (!card) return <Missing message="Bu kart bulunamadı." back={href({ screen: 'home' })} />
  const category = categoryOf(library, card.id)
  const record = progress.get(card.id)
  const listed = hasCard(weekend, card.id)
  const action = record?.completedAt
    ? { to: href({ screen: 'answers', cardId }), label: 'Cevapları gör' }
    : nextQuestion(card, record) !== 0 && record
      ? { to: href({ screen: 'quiz', cardId }), label: 'Sorulara devam et' }
      : { to: href({ screen: 'quiz', cardId }), label: `Soruları çöz · ${card.questions.length}` }

  return (
    <Screen
      title={card.title}
      subtitle={card.subtitle}
      back={href({ screen: 'home' })}
      above={
        <div className={styles.badges}>
          <CategoryBadge id={category?.id ?? ''} category={category} />
          <span className={styles.minutes}>
            <ClockIcon size={14} strokeWidth={2} />
            yaklaşık 10 dakika
          </span>
        </div>
      }
      footer={
        <LinkButton to={action.to} variant="primary" big>
          {action.label}
          <ArrowRightIcon />
        </LinkButton>
      }
    >
      <h2 className={`${text.sectionTitle} ${styles.later}`}>Kısa bilgiler</h2>
      <ol className={styles.facts}>
        {card.facts.map((fact, i) => (
          <li key={i}>
            <span className={styles.number} aria-hidden="true">
              {i + 1}
            </span>
            <p>{fact}</p>
          </li>
        ))}
      </ol>
      <p className={styles.sources}>
        Kaynak:{' '}
        {card.sources.map((source, i) => (
          <Fragment key={source.url}>
            {i > 0 && ', '}
            <a href={source.url} target="_blank" rel="noopener noreferrer" data-inline>
              {source.name}
            </a>
          </Fragment>
        ))}
      </p>

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Tartışma soruları</h2>
      <div className={styles.discussion}>
        {card.discussion.map((question, i) => (
          <div key={i} className={styles.bubble}>
            <ChatIcon />
            <p>{question}</p>
          </div>
        ))}
      </div>

      <Button aria-pressed={listed} onClick={() => toggleWeekend(card)}>
        {listed ? <BookmarkCheckIcon /> : <BookmarkPlusIcon />}
        {listed ? 'Hafta sonu listende' : 'Hafta sonu listeme ekle'}
      </Button>
      <a className={styles.report} href={`mailto:merhaba@kitshelf.app?subject=FreeTimeKit%20kart%20${encodeURIComponent(card.id)}`}>
        Bir hata mı gördün? Bize yaz
      </a>
    </Screen>
  )
}
