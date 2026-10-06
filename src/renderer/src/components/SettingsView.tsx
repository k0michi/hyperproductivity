import { useI18n, type Locale } from '../i18n'

export function SettingsView() {
  const { locale, setLocale, t } = useI18n()
  return <main className="page-layout">
    <h1>{t('settings')}</h1>
    <section className="panel settings-panel">
      <label htmlFor="language-select">{t('language')}</label>
      <select id="language-select" value={locale} onChange={event => setLocale(event.target.value as Locale)}><option value="ja">日本語</option><option value="en">English</option></select>
    </section>
  </main>
}
