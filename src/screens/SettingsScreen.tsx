import { currentAppearance, saveAppearance, type Appearance } from 'kitshelf-ui/app/appearance.ts'
import BackupCard from 'kitshelf-ui/backup/BackupCard.tsx'
import { saveBackup } from 'kitshelf-ui/backup/save.ts'
import StorageStatus from 'kitshelf-ui/backup/StorageStatus.tsx'
import WipeCard from 'kitshelf-ui/backup/WipeCard.tsx'
import { saveMessage, wipeWarning } from 'kitshelf-ui/backup/texts.ts'
import ChoiceGroup from 'kitshelf-ui/ui/ChoiceGroup.tsx'
import ConfirmDialog from 'kitshelf-ui/ui/ConfirmDialog.tsx'
import { AutoIcon, CheckIcon, DownloadIcon, MoonIcon, SunIcon } from 'kitshelf-ui/ui/icons.tsx'
import { LinkRow, ListCard } from 'kitshelf-ui/ui/ListCard.tsx'
import Screen from 'kitshelf-ui/ui/Screen.tsx'
import SettingsFooter from 'kitshelf-ui/ui/SettingsFooter.tsx'
import text from 'kitshelf-ui/ui/text.module.css'
import { useToast } from 'kitshelf-ui/ui/toastContext.ts'
import { useEffect, useState, type ReactNode } from 'react'
import { useAppData } from '../app/appData.ts'
import { href } from '../app/router.ts'
import { BACKUP_TEXTS, finishedCount, typographic, useBackupReminder, useKitBackup } from '../backup/kitBackup.ts'
import { useRestore } from '../backup/useRestore.tsx'
import { wipeDevice } from '../storage/wipe.ts'
import styles from './SettingsScreen.module.css'

const buildTime = new Date(__BUILD_TIME__).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

const APPEARANCES: { value: Appearance; label: string; icon: ReactNode }[] = [
  { value: 'system', label: 'Oto', icon: <AutoIcon /> },
  { value: 'light', label: 'Açık', icon: <SunIcon /> },
  { value: 'dark', label: 'Koyu', icon: <MoonIcon /> },
]

const megabytes = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

export default function SettingsScreen() {
  const { progress, packs } = useAppData()
  const backup = useKitBackup()
  const { reminder, lastBackupAt, refresh } = useBackupReminder()
  const restore = useRestore(refresh)
  const show = useToast()
  const [usage, setUsage] = useState<number>()
  const [confirming, setConfirming] = useState(false)
  const [wiping, setWiping] = useState(false)
  const [appearance, setAppearance] = useState(currentAppearance)
  const [saving, setSaving] = useState(false)
  const finished = finishedCount(progress.values())

  // How much room the app takes; the browser answers for the whole site, not just our stores.
  useEffect(() => {
    let active = true
    navigator.storage
      ?.estimate?.()
      .then((estimate) => {
        if (active && estimate.usage !== undefined) setUsage(estimate.usage)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [packs, progress])

  // Straight from the tap: saveBackup opens the share sheet before anything is awaited.
  const save = () => {
    setSaving(true)
    void saveBackup(backup).then((result) => {
      setSaving(false)
      refresh()
      const message = saveMessage(result)
      if (message) show(typographic(message), { duration: result.status === 'downloaded' ? 6000 : 4000 })
    })
  }

  const wipe = () => {
    setWiping(true)
    void wipeDevice().then(() => {
      // A full load rather than a router change: every screen has to start from an empty device.
      location.replace(import.meta.env.BASE_URL)
    })
  }

  return (
    <Screen title="Ayarlar" back={href({ screen: 'home' })}>
      <h2 className={text.sectionTitle}>Görünüm</h2>
      <ChoiceGroup
        label="Görünüm"
        hideLabel
        options={APPEARANCES}
        selected={[appearance]}
        onToggle={(value) => {
          saveAppearance(value)
          setAppearance(value)
        }}
      />

      <h2 className={`${text.sectionTitle} ${styles.later}`}>İçerik</h2>
      <ListCard as="nav" label="Konular ve paketler">
        <LinkRow
          to={href({ screen: 'topics' })}
          tile={
            <span className={styles.tile}>
              <DownloadIcon size={20} />
            </span>
          }
          title="Konular ve paketler"
        />
      </ListCard>

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Hakkında</h2>
      <section className={styles.about}>
        <p className={styles.aboutLine}>
          <CheckIcon size={18} strokeWidth={2.2} />
          <span>
            Kartlardaki bilgiler kaynaklarından kontrol edilerek hazırlanır; her kartın altında kaynakları yazar. Bir hata
            görürsen{' '}
            <a href="mailto:merhaba@kitshelf.app" data-inline>
              merhaba@kitshelf.app
            </a>{' '}
            adresine yaz.
          </span>
        </p>
        <p className={styles.aboutLine}>
          <DownloadIcon size={18} />
          Kart paketleri freetime.kitshelf.app’ten iner; bu isteklerde senden hiçbir bilgi gitmez.
        </p>
      </section>

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Bu cihazda</h2>
      <section className={styles.card}>
        <StorageStatus />
        <dl className={styles.facts}>
          <div>
            <dt>Biten kart</dt>
            <dd>{finished}</dd>
          </div>
          <div>
            <dt>İndirilen paket</dt>
            <dd>{packs.length}</dd>
          </div>
          <div>
            <dt>Kapladığı yer</dt>
            <dd>{usage === undefined ? '—' : megabytes(usage)}</dd>
          </div>
        </dl>
      </section>

      <h2 className={`${text.sectionTitle} ${styles.later}`}>Yedek</h2>
      <BackupCard lastBackupAt={lastBackupAt} reminder={reminder} description={BACKUP_TEXTS.card} busy={saving} onSave={save} onFile={restore.open} />

      <WipeCard
        description="Bu cihazdaki her şeyi siler: bitirdiğin kartlar, serin, hafta sonu listen, indirilen paketler ve ayarlar. Geri alınamaz; silmeden önce yedek al."
        busy={wiping}
        onWipe={() => setConfirming(true)}
      />

      <SettingsFooter version={buildTime} />

      {restore.dialogs}

      <ConfirmDialog
        open={confirming}
        title="Her şey silinsin mi?"
        confirmLabel="Evet, sil"
        onConfirm={() => {
          setConfirming(false)
          wipe()
        }}
        onCancel={() => setConfirming(false)}
      >
        {finished > 0 ? (
          <>
            <strong>{finished} biten kart</strong>, serin, hafta sonu listen ve indirilen paketler silinecek.
          </>
        ) : (
          <>Serin, hafta sonu listen ve indirilen paketler silinecek.</>
        )}{' '}
        Uygulama sıfırdan açılacak. {wipeWarning(lastBackupAt)}
      </ConfirmDialog>
    </Screen>
  )
}
