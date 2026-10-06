import { useEffect, useRef, useState } from 'react'
import { AppStore } from '../appStore'
import { formatExp, formatTime } from '../format'
import { useI18n } from '../i18n'
import { useWatcher } from '../store'

type Props = {
  onSkip: () => Promise<void>
  onChangeDeck: (id: string) => void
  onStart: (cardId: string) => Promise<void>
  onFinish: (sessionId: string, note: string) => Promise<void>
}

export function PlayView({ onSkip, onChangeDeck, onStart, onFinish }: Props) {
  const store = useWatcher(AppStore)
  const { locale, t } = useI18n()
  const [now, setNow] = useState(Date.now())
  const feedRef = useRef<HTMLElement | null>(null)
  const wheelDistance = useRef(0)
  const touchStart = useRef<number | null>(null)
  const { data, deckId, card, completedSessionId, note, busy, motion } = store
  const active = data?.sessions.find(session => session.endedAt === null)
  const completed = data?.sessions.find(session => session.id === completedSessionId)
  const currentDeck = data?.decks.find(deck => deck.id === deckId)
  const activeCard = active && data?.cards.find(item => item.id === active.cardId)
  const shownCard = activeCard ?? card
  const elapsed = active ? Math.max(0, now - active.startedAt) : 0
  const currentLevel = elapsed >= 2700000 ? 4 : elapsed >= 900000 ? 3 : elapsed >= 180000 ? 2 : 1
  const lastResult = data?.sessions.find(session => session.endedAt !== null)

  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  useEffect(() => {
    const feed = feedRef.current
    if (!feed || active || (!card && !completed)) return
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('textarea')) return
      event.preventDefault()
      if (event.deltaY < 0) { wheelDistance.current = 0; return }
      wheelDistance.current += event.deltaY
      if (wheelDistance.current >= 75) {
        wheelDistance.current = 0
        void onSkip()
      }
    }
    feed.addEventListener('wheel', onWheel, { passive: false })
    return () => feed.removeEventListener('wheel', onWheel)
  }, [active?.id, completed?.id, card?.id, note, busy, onSkip])

  if (!data) return null
  return <main className="play-layout">
    <div className="page-head">
      <h1>{active ? t('inProgress') : completed ? t('completed') : t('actionCard')}</h1>
      <div className="deck-pills">{data.decks.map(deck => <button key={deck.id} disabled={!!active || !!completed} className={deckId === deck.id ? 'deck-pill selected' : 'deck-pill'} onClick={() => onChangeDeck(deck.id)}>{deck.name}</button>)}</div>
    </div>
    <section
      ref={feedRef}
      className="feed-stage"
      tabIndex={0}
      aria-label={completed ? t('completedFeed') : t('cardFeed')}
      onTouchStart={event => { touchStart.current = (event.target as HTMLElement).closest('textarea, button') ? null : event.touches[0]?.clientY ?? null }}
      onTouchEnd={event => {
        if (touchStart.current !== null && touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current) > 65) void onSkip()
        touchStart.current = null
      }}
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return
        if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); void onSkip() }
      }}
    >
      <div className={`feed-card ${motion} ${completed ? 'completed-card' : ''}`}>
        {completed ? <>
          <div className="completion-heading"><span>{completed.cardTitle}</span><h2>{t('completed')}</h2></div>
          <div className="completion-result"><div><span>Lv</span><strong>{completed.level}</strong></div><div><span>EXP</span><strong>+{formatExp(completed.exp ?? 0, locale)}</strong></div><div><span>{t('time')}</span><strong>{formatTime(completed.durationMs ?? 0)}</strong></div></div>
          <div className="completion-note"><label className="field-label" htmlFor="completion-note">{t('note')} <span>{t('optional')}</span></label><textarea id="completion-note" value={note} maxLength={1000} onChange={event => store.set({ note: event.target.value })} placeholder={t('reflectionPlaceholder')} /></div>
        </> : shownCard ? <>
          <div className="card-copy"><span>{currentDeck?.name ?? active?.deckName}</span><h2>{shownCard.title}</h2><p>{shownCard.cue}</p></div>
          <div className="goals">{shownCard.goals.map((goal, index) => <div className="goal" key={index}><b className={active && currentLevel === index + 1 ? 'lit' : ''}>Lv {index + 1}</b><span>{goal || t('freeGoal')}</span></div>)}</div>
          <div className="feed-controls">
            {active ? <>
              <div className="timer">{formatTime(elapsed)} <span>Lv {currentLevel}</span></div>
              <label className="field-label" htmlFor="session-note">{t('note')} <span>{t('optional')}</span></label>
              <textarea id="session-note" value={note} maxLength={1000} onChange={event => store.set({ note: event.target.value })} placeholder={t('progressPlaceholder')} />
              <button className="primary-button" disabled={busy} onClick={() => void onFinish(active.id, note)}>{t('finish')}</button>
            </> : <button className="primary-button" disabled={!card || busy} onClick={() => { if (card) void onStart(card.id).then(() => setNow(Date.now())) }}>{t('start')}</button>}
          </div>
        </> : <div className="empty-card"><strong>{t('noCards')}</strong><p>{t('addCardHint')}</p></div>}
      </div>
      {!active && (shownCard || completed) && <div className="scroll-cue" aria-hidden="true">↓</div>}
    </section>
    {lastResult && !completed && <div className="last-result"><span>{t('previous')}</span><strong>{lastResult.cardTitle}</strong><span>Lv {lastResult.level}　+{formatExp(lastResult.exp ?? 0, locale)} EXP</span></div>}
  </main>
}
