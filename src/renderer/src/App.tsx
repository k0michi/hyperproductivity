import { useEffect, useRef } from 'react'
import { AppStore } from './appStore'
import { DecksView } from './components/DecksView'
import { HistoryView } from './components/HistoryView'
import { PlayView } from './components/PlayView'
import { SettingsView } from './components/SettingsView'
import { TopBar } from './components/TopBar'
import { useI18n } from './i18n'
import { useWatcher } from './store'
import './api'

export default function App() {
  const store = useWatcher(AppStore)
  const { t } = useI18n()
  const { data, tab, deckId, card, completedSessionId, note, busy } = store
  const active = data?.sessions.find(session => session.endedAt === null)
  const completed = data?.sessions.find(session => session.id === completedSessionId)
  const skipLock = useRef(false)
  const drawLock = useRef(false)
  const noteSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const noteTransition = useRef(false)

  useEffect(() => {
    let alive = true
    window.api.state().then(state => {
      if (!alive) return
      const running = state.sessions.find(session => session.endedAt === null)
      store.set({ data: state, deckId: running?.deckId ?? state.decks[0]?.id ?? '', note: running?.note ?? '' })
    }).catch(error => store.set({ notice: String(error) }))
    return () => { alive = false }
  }, [])

  useEffect(() => {
    if (!deckId || active || completedSessionId || drawLock.current) return
    let alive = true
    store.set({ card: null })
    window.api.draw(deckId).then(next => { if (alive) store.set({ card: next }) }).catch(error => store.set({ notice: String(error) }))
    return () => { alive = false }
  }, [deckId, active?.id, completedSessionId])

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

  async function skipCard(): Promise<void> {
    if ((!card && !completed) || active || busy || skipLock.current) return
    skipLock.current = true
    drawLock.current = true
    noteTransition.current = true
    store.set({ busy: true })
    try {
      if (completed) { await noteSaveQueue.current; if (note !== completed.note) await saveNote(completed.id, note) }
      store.set({ motion: 'leaving' })
      await new Promise(resolve => window.setTimeout(resolve, 180))
      const next = completed ? await window.api.draw(deckId, completed.cardId) : await window.api.skip(card!.id)
      store.set(completed ? { card: next, completedSessionId: null, note: '', motion: 'entering' } : { card: next, motion: 'entering' })
      await new Promise(resolve => window.setTimeout(resolve, 220))
    } catch (error) {
      store.set({ notice: error instanceof Error ? error.message : String(error) })
    } finally {
      store.set({ motion: '', busy: false })
      skipLock.current = false
      drawLock.current = false
      noteTransition.current = false
    }
  }

  function changeDeck(id: string): void {
    if (!active && !completed && !skipLock.current) store.set({ card: null, deckId: id })
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
        store.set({ data: result, completedSessionId: sessionId, note: result.sessions.find(session => session.id === sessionId)?.note ?? '' })
      } finally { noteTransition.current = false }
    })
  }

  if (!data) return <main className="loading">{t('loading')}</main>
  return <div className="app-shell">
    <TopBar />
    {store.notice && <div className="notice" role="alert">{store.notice}<button onClick={() => store.set({ notice: '' })}>×</button></div>}
    {tab === 'play' && <PlayView onSkip={skipCard} onChangeDeck={changeDeck} onStart={start} onFinish={finish} />}
    {tab === 'history' && <HistoryView />}
    {tab === 'decks' && <DecksView onChangeDeck={changeDeck} run={run} />}
    {tab === 'settings' && <SettingsView />}
  </div>
}
