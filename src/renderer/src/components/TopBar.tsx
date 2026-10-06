import styles from './TopBar.module.css'
import { AppStore, type Tab } from '../appStore'
import { formatExp } from '../format'
import { useI18n } from '../i18n'
import { useWatcher } from '../store'

export function TopBar() {
  const store = useWatcher(AppStore)
  const { locale, t } = useI18n()
  const tabs: Tab[] = ['play', 'history', 'decks', 'settings']

  return (
    <header className={styles['topbar']}>
      <strong className={styles['brand']}>Hyperproductivity</strong>
      <nav aria-label={t('menu')}>
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`${styles.nav} ${store.tab === tab ? styles.active : ''}`}
            onClick={() => store.set({ tab })}
          >
            {t(tab)}
          </button>
        ))}
      </nav>
      <div className={styles['exp-counter']}>
        <strong>{formatExp(store.data?.totalExp ?? 0, locale)}</strong>
        <span>EXP</span>
      </div>
    </header>
  )
}
