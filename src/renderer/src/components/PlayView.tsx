import shared from '../shared.module.css'
import styles from './PlayView.module.css'
import { useEffect, useRef, useState } from 'react'
import { AppStore, type PlayMode } from '../appStore'
import { formatExp, formatTime } from '../format'
import { useI18n } from '../i18n'
import { useWatcher } from '../store'
import { PressableButton } from './PressableButton'

type Props = {
  onNavigate: (direction: 'next' | 'previous') => Promise<void>
  onChangeMode: (mode: PlayMode) => void
  onChangeDeck: (id: string) => void
  onSelectCard: (id: string) => void
  onStart: (cardId: string) => Promise<void>
  onFinish: (sessionId: string, note: string) => Promise<void>
}

export function PlayView({
  onNavigate,
  onChangeMode,
  onChangeDeck,
  onSelectCard,
  onStart,
  onFinish,
}: Props) {
  const store = useWatcher(AppStore)
  const { locale, t } = useI18n()
  const [now, setNow] = useState(Date.now())
  const feedRef = useRef<HTMLElement | null>(null)
  const wheelDistance = useRef(0)
  const touchStart = useRef<number | null>(null)
  const {
    data,
    playMode,
    deckId,
    selectedCardId,
    card,
    feedHistory,
    feedIndex,
    completedSessionId,
    note,
    busy,
    motion,
  } = store
  const active = data?.sessions.find((session) => session.endedAt === null)
  const completed = data?.sessions.find((session) => session.id === completedSessionId)
  const activeCard = active && data?.cards.find((item) => item.id === active.cardId)
  const shownCard = activeCard ?? card
  const shownDeck = data?.decks.find((deck) => deck.id === shownCard?.deckId)
  const canGoNext = playMode !== 'card' || !!completed || feedIndex < feedHistory.length - 1
  const elapsed = active ? Math.max(0, now - active.startedAt) : 0
  const currentLevel = elapsed >= 2700000 ? 4 : elapsed >= 900000 ? 3 : elapsed >= 180000 ? 2 : 1
  const lastResult = data?.sessions.find((session) => session.endedAt !== null)

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [])
  useEffect(() => {
    const feed = feedRef.current
    if (!feed || active || (!card && !completed)) return
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('textarea')) return
      event.preventDefault()
      if (Math.sign(event.deltaY) !== Math.sign(wheelDistance.current)) wheelDistance.current = 0
      wheelDistance.current += event.deltaY
      if (Math.abs(wheelDistance.current) >= 75) {
        const direction = wheelDistance.current > 0 ? 'next' : 'previous'
        wheelDistance.current = 0
        void onNavigate(direction)
      }
    }
    feed.addEventListener('wheel', onWheel, { passive: false })
    return () => feed.removeEventListener('wheel', onWheel)
  }, [active?.id, completed?.id, card?.id, note, busy, onNavigate])

  if (!data) return null
  return (
    <main className={styles['play-layout']}>
      <div className={styles['page-head']}>
        <h1>{active ? t('inProgress') : completed ? t('completed') : t('actionCard')}</h1>
        <div className={styles['mode-picker']} role="group" aria-label={t('play')}>
          {(['all', 'deck', 'card'] as PlayMode[]).map((mode) => (
            <button
              key={mode}
              disabled={!!active || busy}
              className={`${styles['mode-option']} ${playMode === mode ? styles.selected : ''}`}
              aria-pressed={playMode === mode}
              onClick={() => onChangeMode(mode)}
            >
              {t(mode === 'all' ? 'allMode' : mode === 'deck' ? 'deckMode' : 'cardMode')}
            </button>
          ))}
        </div>
      </div>
      {playMode === 'deck' && (
        <div className={`${styles['mode-detail']} ${styles['deck-pills']}`}>
          {data.decks.map((deck) => (
            <button
              key={deck.id}
              disabled={!!active || busy}
              className={`${styles['deck-pill']} ${deckId === deck.id ? styles.selected : ''}`}
              onClick={() => onChangeDeck(deck.id)}
            >
              {deck.name}
            </button>
          ))}
        </div>
      )}
      {playMode === 'card' && (
        <div className={`${styles['mode-detail']} ${styles['card-picker']}`}>
          <label htmlFor="selected-card">{t('chooseCard')}</label>
          <select
            id="selected-card"
            value={selectedCardId}
            disabled={!!active || busy}
            onChange={(event) => onSelectCard(event.target.value)}
          >
            {!selectedCardId && <option value="">{t('chooseCard')}</option>}
            {data.decks.map((deck) => (
              <optgroup key={deck.id} label={deck.name}>
                {data.cards
                  .filter((item) => item.deckId === deck.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </div>
      )}
      <section
        ref={feedRef}
        className={styles['feed-stage']}
        tabIndex={0}
        aria-label={
          completed
            ? t(feedIndex > 0 ? 'completedFeedWithBack' : 'completedFeed')
            : canGoNext
              ? t(feedIndex > 0 ? 'cardFeedWithBack' : 'cardFeed')
              : t(feedIndex > 0 ? 'selectedCardFeedWithBack' : 'selectedCardFeed')
        }
        onTouchStart={(event) => {
          touchStart.current = (event.target as HTMLElement).closest('textarea, button')
            ? null
            : (event.touches[0]?.clientY ?? null)
        }}
        onTouchEnd={(event) => {
          if (touchStart.current !== null) {
            const distance =
              touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current)
            if (Math.abs(distance) > 65) void onNavigate(distance > 0 ? 'next' : 'previous')
          }
          touchStart.current = null
        }}
        onKeyDown={(event) => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'ArrowDown' || event.key === 'PageDown') {
            event.preventDefault()
            void onNavigate('next')
          }
          if (event.key === 'ArrowUp' || event.key === 'PageUp') {
            event.preventDefault()
            void onNavigate('previous')
          }
        }}
      >
        <div
          className={`${styles['feed-card']} ${motion ? styles[motion] : ''} ${completed ? styles['completed-card'] : ''}`}
        >
          {completed ? (
            <>
              <div className={styles['completion-heading']}>
                <span>{completed.cardTitle}</span>
                <h2>{t('completed')}</h2>
              </div>
              <div className={styles['completion-result']}>
                <div>
                  <span>Lv</span>
                  <strong>{completed.level}</strong>
                </div>
                <div>
                  <span>EXP</span>
                  <strong>+{formatExp(completed.exp ?? 0, locale)}</strong>
                </div>
                <div>
                  <span>{t('time')}</span>
                  <strong>{formatTime(completed.durationMs ?? 0)}</strong>
                </div>
              </div>
              <div className={styles['completion-note']}>
                <label className={shared['field-label']} htmlFor="completion-note">
                  {t('note')} <span>{t('optional')}</span>
                </label>
                <textarea
                  id="completion-note"
                  value={note}
                  maxLength={1000}
                  onChange={(event) => store.set({ note: event.target.value })}
                  placeholder={t('reflectionPlaceholder')}
                />
              </div>
            </>
          ) : shownCard ? (
            <>
              <div className={styles['card-copy']}>
                <span>{shownDeck?.name ?? active?.deckName}</span>
                <h2>{shownCard.title}</h2>
                <p>{shownCard.cue}</p>
              </div>
              <div className={styles['goals']}>
                {shownCard.goals.map((goal, index) => (
                  <div className={styles['goal']} key={index}>
                    <b className={active && currentLevel === index + 1 ? styles.lit : ''}>
                      Lv {index + 1}
                    </b>
                    <span>{goal || t('freeGoal')}</span>
                  </div>
                ))}
              </div>
              <div className={styles['feed-controls']}>
                {active ? (
                  <>
                    <div className={styles['timer']}>
                      {formatTime(elapsed)} <span>Lv {currentLevel}</span>
                    </div>
                    <label className={shared['field-label']} htmlFor="session-note">
                      {t('note')} <span>{t('optional')}</span>
                    </label>
                    <textarea
                      id="session-note"
                      value={note}
                      maxLength={1000}
                      onChange={(event) => store.set({ note: event.target.value })}
                      placeholder={t('progressPlaceholder')}
                    />
                    <PressableButton
                      tone="danger"
                      disabled={busy}
                      onClick={() => void onFinish(active.id, note)}
                    >
                      {t('finish')}
                    </PressableButton>
                  </>
                ) : (
                  <PressableButton
                    disabled={!card || busy}
                    onClick={() => {
                      if (card) void onStart(card.id).then(() => setNow(Date.now()))
                    }}
                  >
                    {t('start')}
                  </PressableButton>
                )}
              </div>
            </>
          ) : (
            <div className={styles['empty-card']}>
              <strong>{t('noCards')}</strong>
              <p>{t('addCardHint')}</p>
            </div>
          )}
        </div>
        {!active && canGoNext && (shownCard || completed) && (
          <div className={styles['scroll-cue']} aria-hidden="true">
            ↓
          </div>
        )}
        {!active && feedIndex > 0 && (
          <div className={styles['back-cue']} aria-hidden="true">
            ↑
          </div>
        )}
      </section>
      {lastResult && !completed && (
        <div className={styles['last-result']}>
          <span>{t('previous')}</span>
          <strong>{lastResult.cardTitle}</strong>
          <span>
            Lv {lastResult.level}　+{formatExp(lastResult.exp ?? 0, locale)} EXP
          </span>
        </div>
      )}
    </main>
  )
}
