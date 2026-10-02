import { Button, LinkButton } from 'kitshelf-ui/ui/Button.tsx'
import { IconButton } from 'kitshelf-ui/ui/IconButton.tsx'
import { PlusIcon } from 'kitshelf-ui/ui/icons.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useToast } from 'kitshelf-ui/ui/toastContext.ts'
import { useState } from 'react'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { categoryOf, isGone, type Library } from '../cards/library.ts'
import type { WeekendItem } from '../cards/types.ts'
import { CategoryTile } from '../ui/category.tsx'
import { ChatIcon, ExitIcon, UsersIcon } from '../ui/icons.tsx'
import OwnTopicSheet from './OwnTopicSheet.tsx'
import styles from './WeekendScreen.module.css'

const UNDO_MS = 5000

/** What a row says under its title: the card's counts, an own topic's, or why the card cannot be shown. */
function rowText(item: WeekendItem, library: Library): string {
  if (item.kind === 'own') return `Senin konun · ${item.questions?.length ?? 0} tartışma`
  const card = item.cardId ? library.cards.get(item.cardId) : undefined
  if (card) return `${categoryOf(library, card.id)?.label ?? ''} · ${card.questions.length} soru, ${card.discussion.length} tartışma`
  return item.cardId && isGone(library, item.cardId) ? 'Bu kart artık yok' : 'Paketi henüz inmedi'
}

/** Hafta sonu listem: the topics the weekend table will take, in the order they were added (plan 6.7). */
export default function WeekendScreen() {
  const { library, weekend, addOwnTopic, editOwnTopic, removeWeekend } = useAppData()
  const show = useToast()
  const [editing, setEditing] = useState<WeekendItem | 'new'>()

  const remove = (item: WeekendItem, message: string) => {
    const undo = removeWeekend(item.id)
    show(message, { duration: UNDO_MS, action: { label: 'Geri al', onClick: undo } })
  }

  return (
    <Screen
      title="Hafta sonu listem"
      subtitle={`Bu hafta sonu konuşulacaklar · ${weekend.length} konu`}
      back={href({ screen: 'home' })}
      footer={
        weekend.length > 0 ? (
          <LinkButton to={href({ screen: 'table-new' })} variant="primary" big>
            <UsersIcon />
            Masayı kur
          </LinkButton>
        ) : (
          <Button variant="primary" big disabled>
            <UsersIcon />
            Masayı kur
          </Button>
        )
      }
    >
      {weekend.length === 0 ? (
        <p className={styles.empty}>Liste boş. Kartlardan ya da kendi konunla başla.</p>
      ) : (
        <ul className={styles.list}>
          {weekend.map((item) => {
            const card = item.cardId ? library.cards.get(item.cardId) : undefined
            const category = item.cardId ? categoryOf(library, item.cardId) : undefined
            const title = card?.title ?? item.title
            const body = (
              <>
                {item.kind === 'own' ? (
                  <span className={styles.ownTile} aria-hidden="true">
                    <ChatIcon />
                  </span>
                ) : (
                  <CategoryTile id={category?.id ?? item.category ?? ''} category={category} />
                )}
                <span className={styles.lines}>
                  <span className={styles.title}>{title}</span>
                  <span className={styles.meta}>{rowText(item, library)}</span>
                </span>
              </>
            )
            return (
              <li key={item.id} className={styles.row}>
                {item.kind === 'own' ? (
                  <button type="button" className={styles.open} onClick={() => setEditing(item)}>
                    {body}
                  </button>
                ) : card ? (
                  <a className={styles.open} href={href({ screen: 'card', cardId: card.id })}>
                    {body}
                  </a>
                ) : (
                  <span className={styles.open}>{body}</span>
                )}
                <IconButton label={`Listeden çıkar: ${title}`} onClick={() => remove(item, 'Listeden çıkarıldı')}>
                  <ExitIcon />
                </IconButton>
              </li>
            )
          })}
        </ul>
      )}
      <button type="button" className={styles.addOwn} onClick={() => setEditing('new')}>
        <PlusIcon size={20} strokeWidth={2.2} />
        Kendi konunu ekle
      </button>
      <p className={text.hint}>Kendi konunda yalnızca tartışma soruları olur. Masada bilgi soruları puanlı, tartışma soruları puansızdır.</p>

      <OwnTopicSheet
        open={editing !== undefined}
        item={editing === 'new' ? undefined : editing}
        onClose={() => setEditing(undefined)}
        onSave={(title, questions) => {
          if (editing === 'new') addOwnTopic(title, questions)
          else if (editing) editOwnTopic(editing.id, title, questions)
          setEditing(undefined)
        }}
        onDelete={() => {
          if (editing && editing !== 'new') remove(editing, 'Konu silindi')
          setEditing(undefined)
        }}
      />
    </Screen>
  )
}
