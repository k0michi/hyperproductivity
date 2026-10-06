import { useMemo } from 'react'
import { AppStore } from '../appStore'
import { dateKey, formatDate, formatExp, formatTime } from '../format'
import { useI18n } from '../i18n'
import { useWatcher } from '../store'

export function HistoryView() {
  const store = useWatcher(AppStore)
  const { data, selectedDate } = store
  const { locale, t } = useI18n()
  const earned = data?.sessions.filter(session => session.endedAt !== null) ?? []
  const heatmap = useMemo(() => {
    const days: Array<{ key: string; count: number; exp: number }> = []
    const map = new Map<string, { count: number; exp: number }>()
    for (const session of earned) {
      const old = map.get(session.localDate) ?? { count: 0, exp: 0 }
      map.set(session.localDate, { count: old.count + 1, exp: old.exp + (session.exp ?? 0) })
    }
    const today = new Date(); today.setHours(0, 0, 0, 0)
    const start = new Date(today); start.setDate(start.getDate() - 83)
    start.setDate(start.getDate() - start.getDay())
    for (let day = new Date(start); day <= today; day.setDate(day.getDate() + 1)) {
      const key = dateKey(day)
      days.push({ key, ...(map.get(key) ?? { count: 0, exp: 0 }) })
    }
    return days
  }, [data])
  if (!data) return null
  const selectedSessions = earned.filter(session => session.localDate === selectedDate)

  return <main className="page-layout">
    <h1>{t('history')}</h1>
    <section className="panel history-panel">
      <div className="panel-title"><h2>{t('actionHistory')}</h2><span>{t('starts')}</span></div>
      <div className="heatmap" role="grid" aria-label={t('dailyHistory')}>{heatmap.map(day => <button key={day.key} title={t('daySummary', { date: formatDate(day.key, locale), count: day.count, exp: formatExp(day.exp, locale) })} aria-label={t('dayAria', { date: formatDate(day.key, locale), count: day.count, exp: formatExp(day.exp, locale) })} className={`heat-cell heat-${Math.min(4, day.count)} ${selectedDate === day.key ? 'picked' : ''}`} onClick={() => store.set({ selectedDate: day.key })} />)}</div>
      <div className="legend"><span>{t('less')}</span><i/><i/><i/><i/><i/><span>{t('more')}</span></div>
    </section>
    <div className="history-bottom">
      <section className="panel day-panel"><div className="panel-title"><h2>{formatDate(selectedDate, locale)}</h2><span>{t('count', { count: selectedSessions.length })}</span></div>
        {selectedSessions.length ? selectedSessions.map(session => <div className="session-row" key={session.id}><span className="session-level">Lv {session.level}</span><div><strong>{session.cardTitle}</strong><small>{session.deckName} · {new Date(session.startedAt).toLocaleTimeString(locale === 'ja' ? 'ja-JP' : 'en-US', { hour: '2-digit', minute: '2-digit' })} · {formatTime(session.durationMs ?? 0)}</small>{session.note && <p>{session.note}</p>}</div><b>+{formatExp(session.exp ?? 0, locale)}</b></div>) : <p className="quiet">{t('noRecords')}</p>}
      </section>
      <section className="panel totals-panel"><div><small>{t('totalExp')}</small><strong>{formatExp(data.totalExp, locale)}</strong></div><div><small>{t('actionCount')}</small><strong>{earned.length}</strong></div></section>
    </div>
  </main>
}
