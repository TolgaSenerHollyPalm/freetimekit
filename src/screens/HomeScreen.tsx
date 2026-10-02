import { Button, LinkButton } from 'kitshelf-ui/ui/Button.tsx'
import { IconLink } from 'kitshelf-ui/ui/IconButton.tsx'
import { ArrowRightIcon, CheckIcon, ChevronRightIcon, SlidersIcon } from 'kitshelf-ui/ui/icons.tsx'
import IosInstallHint from 'kitshelf-ui/ui/IosInstallHint.tsx'
import { LinkRow, ListCard } from 'kitshelf-ui/ui/ListCard.tsx'
import OnlineBadge from 'kitshelf-ui/ui/OnlineBadge.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useOnline } from 'kitshelf-ui/ui/useOnline.ts'
import type { ReactNode } from 'react'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { dayTitle } from '../cards/dates.ts'
import { categoryOf } from '../cards/library.ts'
import { streak, streakText, todayStatus } from '../cards/progress.ts'
import { KEYS, KIT_NAME } from '../kit.ts'
import type { Card } from '../packs/types.ts'
import { CategoryTile } from '../ui/category.tsx'
import { categoryStyle } from '../ui/categoryStyle.ts'
import { BoltIcon, BookmarkIcon, CategoryIcon, ClockIcon, UsersIcon } from '../ui/icons.tsx'
import styles from './HomeScreen.module.css'

const BUTTONS = { start: 'Başla', continue: 'Devam et', done: 'Kartı aç' }

/** The day's card: its category's colour on top, what is in it and the way in below. */
function DailyCard({ card }: { card: Card }) {
  const { library, todayLog, progress } = useAppData()
  const category = categoryOf(library, card.id)
  const status = todayStatus(todayLog!, progress)
  const to = href({ screen: 'card', cardId: card.id })
  return (
    <article className={styles.daily}>
      <a className={styles.dailyTop} href={to} style={categoryStyle(category)}>
        <span className={styles.dailyLine}>
          <span className={styles.dailyPill}>Günün kartı</span>
          <span className={styles.dailyCategory}>
            <CategoryIcon id={category?.id ?? ''} size={18} />
            {category?.label}
          </span>
        </span>
        {/* Long titles step down, or they would fill four lines at the design's size. */}
        <span className={card.title.length > 18 ? `${styles.dailyTitle} ${styles.long}` : styles.dailyTitle}>{card.title}</span>
        <span className={styles.dailySubtitle}>{card.subtitle}</span>
      </a>
      <div className={styles.dailyBottom}>
        <div className={styles.counts}>
          <Count n={card.facts.length} label="bilgi" />
          <Count n={card.questions.length} label="soru" />
          <Count n={card.discussion.length} label="tartışma" />
        </div>
        <div className={styles.dailyAction}>
          {status === 'done' ? (
            <span className={styles.finished}>
              <CheckIcon size={18} strokeWidth={2.6} />
              Tamamlandı
            </span>
          ) : (
            <span className={styles.minutes}>
              <ClockIcon />
              yaklaşık 10 dakika
            </span>
          )}
          <a className={styles.go} href={to}>
            {BUTTONS[status]}
            <ArrowRightIcon />
          </a>
        </div>
      </div>
    </article>
  )
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <span className={styles.count}>
      <span className={styles.countNumber}>{n}</span>
      <span className={styles.countLabel}>{label}</span>
    </span>
  )
}

/** No card on the device yet: why, and what to do. */
function NoCards() {
  const { sync, syncPacks } = useAppData()
  const online = useOnline()
  let body: ReactNode
  if (sync.running) {
    body = (
      <>
        <h2 className={styles.emptyTitle}>Kartlar iniyor…</h2>
        <span className={styles.busy} role="progressbar" aria-label="Kartlar iniyor" />
      </>
    )
  } else if (!online) {
    body = (
      <>
        <h2 className={styles.emptyTitle}>Kartların henüz inmedi</h2>
        <p className={text.hint}>İnternete bağlanınca ilgi alanlarının paketleri iner.</p>
      </>
    )
  } else {
    body = (
      <>
        <h2 className={styles.emptyTitle}>Kartlar indirilemedi</h2>
        <Button onClick={() => syncPacks()}>Tekrar dene</Button>
      </>
    )
  }
  return <section className={styles.empty}>{body}</section>
}

/** Bugün, the home screen: the day's card, three more picked for you, and the weekend list. */
export default function HomeScreen({ banner }: { banner?: ReactNode }) {
  const data = useAppData()
  const { library, todayLog, today, days, weekend, table } = data
  const daily = todayLog?.dailyCardId ? library.cards.get(todayLog.dailyCardId) : undefined
  const suggestions = (todayLog?.suggestedCardIds ?? []).flatMap((id) => library.cards.get(id) ?? [])
  const badge = streakText(streak(days, today))

  return (
    <Screen
      title="Bugün"
      eyebrow={dayTitle(today)}
      icon={
        <span className={styles.brand}>
          {/* The app icon itself, so the mark beside the name changes with public/favicon.svg. */}
          <img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={32} height={32} />
          {KIT_NAME}
        </span>
      }
      aside={
        <>
          <OnlineBadge />
          <IconLink to={href({ screen: 'settings' })} label="Ayarlar">
            <SlidersIcon />
          </IconLink>
        </>
      }
      // Screen puts a mark before the title; this one is ordered after it, at the right, as in the design.
      mark={
        badge && (
          <span className={styles.streak}>
            <BoltIcon />
            {badge}
          </span>
        )
      }
    >
      <IosInstallHint dismissedKey={KEYS.installHintDismissed} />
      {banner}
      {daily ? <DailyCard card={daily} /> : <NoCards />}
      {daily && todayLog?.repeat && <p className={styles.repeat}>Yeni kart kalmadı; bu, daha önce gördüğün bir kart. Yeni paketler geldikçe burada olacak.</p>}

      {suggestions.length > 0 && (
        <section className={styles.section} aria-labelledby="picked-title">
          <div className={styles.sectionHead}>
            <h2 id="picked-title" className={text.sectionTitle}>
              Senin için seçtik
            </h2>
            <a className={styles.more} href={href({ screen: 'topics' })}>
              Konular
              <ChevronRightIcon />
            </a>
          </div>
          <ListCard as="nav" label="Senin için seçtik">
            {suggestions.map((card) => {
              const category = categoryOf(library, card.id)
              return <LinkRow key={card.id} to={href({ screen: 'card', cardId: card.id })} tile={<CategoryTile id={category?.id ?? ''} category={category} />} title={card.title} subtitle={category?.label} />
            })}
          </ListCard>
        </section>
      )}

      <section className={styles.weekend} aria-label="Hafta sonu">
        {table && !table.finishedAt && (
          <LinkRow to={href({ screen: 'table' })} tile={<span className={styles.weekendTile}><UsersIcon size={22} /></span>} title="Masaya dön" subtitle={table.topics[0]?.title} />
        )}
        <LinkRow
          to={href({ screen: 'weekend' })}
          tile={
            <span className={styles.weekendTile}>
              <BookmarkIcon />
            </span>
          }
          title="Hafta sonu listem"
          subtitle={weekend.length > 0 ? `${weekend.length} konu` : 'Kartlardan konu ekle'}
        />
        {weekend.length > 0 && (
          <div className={styles.play}>
            <LinkButton to={href({ screen: 'table-new' })}>
              <UsersIcon />
              Arkadaşlarla oyna
            </LinkButton>
          </div>
        )}
      </section>
    </Screen>
  )
}
