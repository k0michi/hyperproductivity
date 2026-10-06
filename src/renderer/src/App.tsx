import { useEffect, useRef } from 'react'
import { AppStore, type PlayMode } from './appStore'
import { DecksView } from './components/DecksView'
import { HistoryView } from './components/HistoryView'
import { PlayView } from './components/PlayView'
import { SettingsView } from './components/SettingsView'
import { TopBar } from './components/TopBar'
import { useI18n } from './i18n'
import { useWatcher } from './store'
import './api'

const RECENT_CARD_LIMIT = 11 // Current card plus up to ten previous cards.

export default function App() {
  const store = useWatcher(AppStore)
  const { t } = useI18n()
  const { data, tab, playMode, deckId, selectedCardId, card, feedHistory, feedIndex, completedSessionId, note, busy } = store
  const active = data?.sessions.find(session => session.endedAt === null)
  const completed = data?.sessions.find(session => session.id === completedSessionId)
  const navigationLock = useRef(false)
  const drawLock = useRef(false)
  const noteSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const noteTransition = useRef(false)

  useEffect(() => {
    let alive = true
    window.api.state().then(state => {
      if (!alive) return
      const running = state.sessions.find(session => session.endedAt === null)
      const runningCard = running && state.cards.find(item => item.id === running.cardId)
      store.set({ data: state, deckId: running?.deckId ?? state.decks[0]?.id ?? '', selectedCardId: running?.cardId ?? state.cards[0]?.id ?? '', card: runningCard || null, feedHistory: runningCard ? [{ card: runningCard, completedSessionId: null }] : [], feedIndex: runningCard ? 0 : -1, note: running?.note ?? '' })
    }).catch(error => store.set({ notice: String(error) }))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!data || active || completedSessionId || feedHistory.length || drawLock.current) return
    if ((playMode === 'deck' && !deckId) || (playMode === 'card' && !selectedCardId)) return
    let alive = true
    store.set({ card: null })
    const request = playMode === 'card' ? window.api.presentCard(selectedCardId) : window.api.draw(playMode === 'all' ? null : deckId)
    request.then(next => { if (alive) store.set({ card: next, feedHistory: next ? [{ card: next, completedSessionId: null }] : [], feedIndex: next ? 0 : -1 }) }).catch(error => store.set({ notice: String(error) }))
    return () => { alive = false }
  }, [playMode, deckId, selectedCardId, active?.id, completedSessionId, feedHistory.length])

  function saveNote(sessionId: string, value: string): Promise<void> {
    const pending = noteSaveQueue.current.catch(() => {}).then(async () => {
      store.set({ data: await window.api.saveNote(sessionId, value) })
    })
    noteSaveQueue.current = pending
    return pending
  }

  useEffect(() => {
    const sessionId = active?.id ?? completed?.id
    if (!sessionId || note === (active ?? completed)?.note || noteTransition.current) return
    const timer = window.setTimeout(() => {
      if (noteTransition.current) return
      void saveNote(sessionId, note).catch(error => store.set({ notice: error instanceof Error ? error.message : String(error) }))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [active?.id, completed?.id, note, active?.note, completed?.note])

  async function run(action: () => Promise<void>): Promise<void> {
    if (store.busy) return
    store.set({ busy: true, notice: '' })
    try { await action() }
    catch (error) { store.set({ notice: error instanceof Error ? error.message : String(error) }) }
    finally { store.set({ busy: false }) }
  }

  async function navigateCard(direction: 'next' | 'previous'): Promise<void> {
    if ((!card && !completed) || active || busy || navigationLock.current || (direction === 'previous' && feedIndex <= 0)) return
    if (direction === 'next' && playMode === 'card' && !completed && feedIndex === feedHistory.length - 1) return
    navigationLock.current = true
    drawLock.current = true
    noteTransition.current = true
    store.set({ busy: true })
    try {
      if (completed) { await noteSaveQueue.current; if (note !== completed.note) await saveNote(completed.id, note) }
      store.set({ motion: direction === 'previous' ? 'leaving-back' : 'leaving' })
      await new Promise(resolve => window.setTimeout(resolve, 180))
      const targetIndex = feedIndex + (direction === 'previous' ? -1 : 1)
      const existing = feedHistory[targetIndex]
      if (existing) {
        const targetSession = store.data?.sessions.find(session => session.id === existing.completedSessionId)
        store.set({ card: existing.card, feedIndex: targetIndex, completedSessionId: existing.completedSessionId, note: targetSession?.note ?? '', motion: direction === 'previous' ? 'entering-back' : 'entering' })
      } else {
        const scopeDeckId = playMode === 'all' ? null : deckId
        const next = playMode === 'card'
          ? await window.api.presentCard(selectedCardId)
          : completed ? await window.api.draw(scopeDeckId, completed.cardId) : await window.api.skip(card!.id, scopeDeckId)
        const history = next ? [...feedHistory, { card: next, completedSessionId: null }].slice(-RECENT_CARD_LIMIT) : feedHistory
        store.set({ card: next, feedHistory: history, feedIndex: next ? history.length - 1 : feedIndex, completedSessionId: null, note: '', motion: 'entering' })
      }
      await new Promise(resolve => window.setTimeout(resolve, 220))
    } catch (error) {
      store.set({ notice: error instanceof Error ? error.message : String(error) })
    } finally {
      store.set({ motion: '', busy: false })
      navigationLock.current = false
      drawLock.current = false
      noteTransition.current = false
    }
  }

  async function changeSelection(mode: PlayMode, nextDeckId = deckId, nextCardId = selectedCardId): Promise<void> {
    if (active || busy || navigationLock.current) return
    if (!completed && mode === playMode && nextDeckId === deckId && nextCardId === selectedCardId) return
    navigationLock.current = true
    noteTransition.current = true
    store.set({ busy: true })
    try {
      if (completed) {
        await noteSaveQueue.current
        if (note !== store.data?.sessions.find(session => session.id === completed.id)?.note) await saveNote(completed.id, note)
      }
      navigationLock.current = false
      store.set({ playMode: mode, deckId: nextDeckId, selectedCardId: mode === 'card' ? nextCardId || data?.cards[0]?.id || '' : nextCardId, card: null, feedHistory: [], feedIndex: -1, completedSessionId: null, note: '', busy: false })
    } catch (error) {
      store.set({ notice: error instanceof Error ? error.message : String(error), busy: false })
    } finally {
      navigationLock.current = false
      noteTransition.current = false
    }
  }

  function changeDeck(id: string): void { void changeSelection('deck', id) }

  function changeMode(mode: PlayMode): void { void changeSelection(mode) }

  function selectCard(id: string): void { void changeSelection('card', deckId, id) }

  function manageDeck(id: string): void {
    if (!active && !completed && !navigationLock.current && id !== deckId) store.set(playMode === 'deck' ? { deckId: id, card: null, feedHistory: [], feedIndex: -1, note: '' } : { deckId: id })
  }

  async function start(cardId: string): Promise<void> {
    await run(async () => {
      const sessionId = await window.api.start(cardId)
      const state = await window.api.state()
      store.set({ data: state, note: state.sessions.find(session => session.id === sessionId)?.note ?? '' })
    })
  }

  async function finish(sessionId: string, currentNote: string): Promise<void> {
    await run(async () => {
      noteTransition.current = true
      try {
        await noteSaveQueue.current
        const result = await window.api.finish(sessionId, currentNote)
        const finishedCard = store.card ?? result.cards.find(item => item.id === result.sessions.find(session => session.id === sessionId)?.cardId) ?? null
        const history = [...store.feedHistory]
        if (store.feedIndex >= 0 && history[store.feedIndex]) history[store.feedIndex] = { ...history[store.feedIndex], completedSessionId: sessionId }
        else if (finishedCard) history.push({ card: finishedCard, completedSessionId: sessionId })
        store.set({ data: result, card: finishedCard, feedHistory: history, feedIndex: store.feedIndex >= 0 ? store.feedIndex : history.length - 1, completedSessionId: sessionId, note: result.sessions.find(session => session.id === sessionId)?.note ?? '' })
      } finally { noteTransition.current = false }
    })
  }

  if (!data) return <main className="loading">{t('loading')}</main>
  return <div className="app-shell">
    <TopBar />
    {store.notice && <div className="notice" role="alert">{store.notice}<button onClick={() => store.set({ notice: '' })}>×</button></div>}
    {tab === 'play' && <PlayView onNavigate={navigateCard} onChangeMode={changeMode} onChangeDeck={changeDeck} onSelectCard={selectCard} onStart={start} onFinish={finish} />}
    {tab === 'history' && <HistoryView />}
    {tab === 'decks' && <DecksView onChangeDeck={manageDeck} run={run} />}
    {tab === 'settings' && <SettingsView />}
  </div>
}
