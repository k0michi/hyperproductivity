import { useEffect, useMemo, useRef, useState } from 'react'

type Deck = { id: string; name: string; color: string }
type Card = { id: string; deckId: string; title: string; cue: string; goals: string[]; weight: number }
type Session = { id: string; deckId: string; cardId: string; deckName: string; cardTitle: string; startedAt: number; endedAt: number | null; durationMs: number | null; level: number | null; exp: number | null; localDate: string; note: string }
type State = { decks: Deck[]; cards: Card[]; sessions: Session[]; totalExp: number; formula: { b: number; a: number; p: number } }
type Api = { state: () => Promise<State>; draw: (deckId: string, excludeId?: string) => Promise<Card | null>; skip: (cardId: string) => Promise<Card | null>; start: (cardId: string) => Promise<string>; finish: (sessionId: string, note: string) => Promise<State>; saveNote: (sessionId: string, note: string) => Promise<State>; addDeck: (name: string) => Promise<State>; addCard: (deckId: string, title: string, cue: string, goals: string[]) => Promise<State> }
declare global { interface Window { api: Api } }

const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const formatTime = (ms: number) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
const formatExp = (value: number) => value.toLocaleString('ja-JP', { maximumFractionDigits: 1 })
const formatDate = (key: string) => new Date(`${key}T00:00:00`).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })

export default function App() {
  const [data, setData] = useState<State | null>(null)
  const [tab, setTab] = useState<'play' | 'history' | 'decks'>('play')
  const [deckId, setDeckId] = useState('')
  const [card, setCard] = useState<Card | null>(null)
  const [completedSessionId, setCompletedSessionId] = useState<string | null>(null)
  const [now, setNow] = useState(Date.now())
  const [note, setNote] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [motion, setMotion] = useState<'leaving' | 'entering' | ''>('')
  const feedRef = useRef<HTMLElement | null>(null)
  const wheelDistance = useRef(0)
  const touchStart = useRef<number | null>(null)
  const skipLock = useRef(false)
  const drawLock = useRef(false)
  const noteSaveQueue = useRef<Promise<void>>(Promise.resolve())
  const noteTransition = useRef(false)
  const [selectedDate, setSelectedDate] = useState(dateKey(new Date()))
  const [newDeck, setNewDeck] = useState('')
  const [newTitle, setNewTitle] = useState('')
  const [newCue, setNewCue] = useState('')
  const [newGoals, setNewGoals] = useState(['', '', '', ''])
  const active = data?.sessions.find(s => s.endedAt === null)
  const completed = data?.sessions.find(s => s.id === completedSessionId)
  const currentDeck = data?.decks.find(d => d.id === deckId)
  const activeCard = active && data?.cards.find(c => c.id === active.cardId)
  const shownCard = activeCard ?? card
  const elapsed = active ? Math.max(0, now - active.startedAt) : 0
  const currentLevel = elapsed >= 2700000 ? 4 : elapsed >= 900000 ? 3 : elapsed >= 180000 ? 2 : 1
  const earned = data?.sessions.filter(s => s.endedAt !== null) ?? []
  const lastResult = earned[0]

  useEffect(() => {
    let alive = true
    window.api.state().then(state => {
      if (!alive) return
      setData(state)
      setDeckId(state.sessions.find(s => s.endedAt === null)?.deckId ?? state.decks[0]?.id ?? '')
      setNote(state.sessions.find(s => s.endedAt === null)?.note ?? '')
    }).catch(error => setNotice(String(error)))
    return () => { alive = false }
  }, [])
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id) }, [])
  useEffect(() => {
    if (!deckId || active || completedSessionId || drawLock.current) return
    let alive = true
    setCard(null)
    window.api.draw(deckId).then(next => { if (alive) setCard(next) }).catch(error => setNotice(String(error)))
    return () => { alive = false }
  }, [deckId, active?.id, completedSessionId])
  function saveNote(sessionId: string, value: string): Promise<void> {
    const pending = noteSaveQueue.current.catch(() => {}).then(async () => {
      const state = await window.api.saveNote(sessionId, value)
      setData(state)
    })
    noteSaveQueue.current = pending
    return pending
  }
  useEffect(() => {
    const sessionId = active?.id ?? completed?.id
    if (!sessionId || note === (active ?? completed)?.note || noteTransition.current) return
    const timer = window.setTimeout(() => {
      if (noteTransition.current) return
      void saveNote(sessionId, note).catch(error => setNotice(error instanceof Error ? error.message : String(error)))
    }, 500)
    return () => window.clearTimeout(timer)
  }, [active?.id, completed?.id, note, active?.note, completed?.note])

  async function run(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setNotice('')
    try { await action() } catch (error) { setNotice(error instanceof Error ? error.message : String(error)) }
    finally { setBusy(false) }
  }
  async function skipCard() {
    if ((!card && !completed) || active || busy || skipLock.current) return
    skipLock.current = true
    drawLock.current = true
    noteTransition.current = true
    setBusy(true)
    try {
      if (completed) { await noteSaveQueue.current; if (note !== completed.note) await saveNote(completed.id, note) }
      setMotion('leaving')
      await new Promise(resolve => window.setTimeout(resolve, 180))
      const next = completed ? await window.api.draw(deckId, completed.cardId) : await window.api.skip(card!.id)
      setCard(next)
      if (completed) { setCompletedSessionId(null); setNote('') }
      setMotion('entering')
      await new Promise(resolve => window.setTimeout(resolve, 220))
    } catch (error) {
      setNotice(error instanceof Error ? error.message : String(error))
    } finally {
      setMotion('')
      setBusy(false)
      skipLock.current = false
      drawLock.current = false
      noteTransition.current = false
    }
  }
  function changeDeck(id: string) { if (!active && !completed && !skipLock.current) { setCard(null); setDeckId(id) } }
  useEffect(() => {
    const feed = feedRef.current
    if (!feed || tab !== 'play' || active || (!card && !completed)) return
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest('textarea')) return
      event.preventDefault()
      if (event.deltaY < 0) { wheelDistance.current = 0; return }
      wheelDistance.current += event.deltaY
      if (wheelDistance.current >= 75) {
        wheelDistance.current = 0
        void skipCard()
      }
    }
    feed.addEventListener('wheel', onWheel, { passive: false })
    return () => feed.removeEventListener('wheel', onWheel)
  }, [tab, active?.id, completed?.id, card?.id, note, busy])
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
    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
      const key = dateKey(d); days.push({ key, ...(map.get(key) ?? { count: 0, exp: 0 }) })
    }
    return days
  }, [data])
  const selectedSessions = earned.filter(s => s.localDate === selectedDate)

  if (!data) return <main className="loading">読み込み中</main>

  return <div className="app-shell">
    <header className="topbar">
      <strong className="brand">Hyperproductivity</strong>
      <nav aria-label="メインメニュー">
        <button className={tab === 'play' ? 'nav active' : 'nav'} onClick={() => setTab('play')}>行動</button>
        <button className={tab === 'history' ? 'nav active' : 'nav'} onClick={() => setTab('history')}>記録</button>
        <button className={tab === 'decks' ? 'nav active' : 'nav'} onClick={() => setTab('decks')}>デッキ</button>
      </nav>
      <div className="exp-counter"><strong>{formatExp(data.totalExp)}</strong><span>EXP</span></div>
    </header>
    {notice && <div className="notice" role="alert">{notice}<button onClick={() => setNotice('')}>×</button></div>}

    {tab === 'play' && <main className="play-layout">
      <div className="page-head">
        <h1>{active ? '取り組み中' : completed ? '完了' : '行動カード'}</h1>
        <div className="deck-pills">{data.decks.map(d => <button key={d.id} disabled={!!active || !!completed} className={deckId === d.id ? 'deck-pill selected' : 'deck-pill'} onClick={() => changeDeck(d.id)}>{d.name}</button>)}</div>
      </div>
      <section
        ref={feedRef}
        className="feed-stage"
        tabIndex={0}
        aria-label={completed ? '完了結果。下にスクロールすると次のカード' : '行動カード。下にスクロールすると次のカード'}
        onTouchStart={event => { touchStart.current = (event.target as HTMLElement).closest('textarea, button') ? null : event.touches[0]?.clientY ?? null }}
        onTouchEnd={event => {
          if (touchStart.current !== null && touchStart.current - (event.changedTouches[0]?.clientY ?? touchStart.current) > 65) void skipCard()
          touchStart.current = null
        }}
        onKeyDown={event => {
          if (event.target !== event.currentTarget) return
          if (event.key === 'ArrowDown' || event.key === 'PageDown') { event.preventDefault(); void skipCard() }
        }}
      >
        <div className={`feed-card ${motion} ${completed ? 'completed-card' : ''}`}>
          {completed ? <>
            <div className="completion-heading"><span>{completed.cardTitle}</span><h2>完了</h2></div>
            <div className="completion-result"><div><span>Lv</span><strong>{completed.level}</strong></div><div><span>EXP</span><strong>+{formatExp(completed.exp ?? 0)}</strong></div><div><span>時間</span><strong>{formatTime(completed.durationMs ?? 0)}</strong></div></div>
            <div className="completion-note"><label className="field-label" htmlFor="completion-note">メモ <span>任意</span></label><textarea id="completion-note" value={note} maxLength={1000} onChange={event => setNote(event.target.value)} placeholder="振り返りを残す" /></div>
          </> : shownCard ? <>
            <div className="card-copy"><span>{currentDeck?.name ?? active?.deckName}</span><h2>{shownCard.title}</h2><p>{shownCard.cue}</p></div>
            <div className="goals">{shownCard.goals.map((goal, i) => <div className="goal" key={i}><b className={active && currentLevel === i + 1 ? 'lit' : ''}>Lv {i + 1}</b><span>{goal || '自由に取り組む'}</span></div>)}</div>
            <div className="feed-controls">
              {active ? <>
                <div className="timer">{formatTime(elapsed)} <span>Lv {currentLevel}</span></div>
                <label className="field-label" htmlFor="session-note">メモ <span>任意</span></label>
                <textarea id="session-note" value={note} maxLength={1000} onChange={event => setNote(event.target.value)} placeholder="途中の気づきを残す" />
                <button className="primary-button" disabled={busy} onClick={() => run(async () => { noteTransition.current = true; try { await noteSaveQueue.current; const result = await window.api.finish(active.id, note); setData(result); setCompletedSessionId(active.id); setNote(result.sessions.find(s => s.id === active.id)?.note ?? '') } finally { noteTransition.current = false } })}>終了する</button>
              </> : <button className="primary-button" disabled={!card || busy} onClick={() => run(async () => { const sessionId = await window.api.start(card!.id); const state = await window.api.state(); setData(state); setNote(state.sessions.find(s => s.id === sessionId)?.note ?? ''); setNow(Date.now()) })}>はじめる</button>}
            </div>
          </> : <div className="empty-card"><strong>カードがありません</strong><p>デッキからカードを追加してください。</p></div>}
        </div>
        {!active && (shownCard || completed) && <div className="scroll-cue" aria-hidden="true">↓</div>}
      </section>
      {lastResult && !completed && <div className="last-result"><span>前回</span><strong>{lastResult.cardTitle}</strong><span>Lv {lastResult.level}　+{formatExp(lastResult.exp ?? 0)} EXP</span></div>}
    </main>}

    {tab === 'history' && <main className="page-layout">
      <h1>記録</h1>
      <section className="panel history-panel">
        <div className="panel-title"><h2>行動の記録</h2><span>着手回数</span></div>
        <div className="heatmap" role="grid" aria-label="日別の行動記録">{heatmap.map(day => <button key={day.key} title={`${formatDate(day.key)}: ${day.count}回 / ${formatExp(day.exp)} EXP`} aria-label={`${formatDate(day.key)} ${day.count}回 ${formatExp(day.exp)} EXP`} className={`heat-cell heat-${Math.min(4, day.count)} ${selectedDate === day.key ? 'picked' : ''}`} onClick={() => setSelectedDate(day.key)} />)}</div>
        <div className="legend"><span>少</span><i/><i/><i/><i/><i/><span>多</span></div>
      </section>
      <div className="history-bottom">
        <section className="panel day-panel"><div className="panel-title"><h2>{formatDate(selectedDate)}</h2><span>{selectedSessions.length}回</span></div>
          {selectedSessions.length ? selectedSessions.map(s => <div className="session-row" key={s.id}><span className="session-level">Lv {s.level}</span><div><strong>{s.cardTitle}</strong><small>{s.deckName} · {new Date(s.startedAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} · {formatTime(s.durationMs ?? 0)}</small>{s.note && <p>{s.note}</p>}</div><b>+{formatExp(s.exp ?? 0)}</b></div>) : <p className="quiet">記録はありません</p>}
        </section>
        <section className="panel totals-panel"><div><small>累計EXP</small><strong>{formatExp(data.totalExp)}</strong></div><div><small>行動回数</small><strong>{earned.length}</strong></div></section>
      </div>
    </main>}

    {tab === 'decks' && <main className="page-layout">
      <h1>デッキ</h1>
      <div className="decks-layout">
        <section className="panel deck-list"><h2>デッキ一覧</h2>{data.decks.map(d => <button key={d.id} className={deckId === d.id ? 'deck-list-item chosen' : 'deck-list-item'} onClick={() => changeDeck(d.id)}><span>{d.name}</span><small>{data.cards.filter(c => c.deckId === d.id).length}枚</small></button>)}
          <form onSubmit={e => { e.preventDefault(); void run(async () => { const state = await window.api.addDeck(newDeck); setData(state); setNewDeck('') }) }}><label className="field-label" htmlFor="deck-name">新しいデッキ</label><div className="inline-input"><input id="deck-name" value={newDeck} onChange={e => setNewDeck(e.target.value)} placeholder="デッキ名" maxLength={40}/><button className="small-button" disabled={busy || !newDeck.trim()}>追加</button></div></form>
        </section>
        <section className="panel cards-workshop"><h2>{currentDeck?.name ?? 'デッキを選択'}</h2><div className="mini-cards">{data.cards.filter(c => c.deckId === deckId).map(c => <div className="mini-card" key={c.id}><b>{c.title}</b><small>{c.cue}</small></div>)}</div>
          <form onSubmit={e => { e.preventDefault(); void run(async () => { setData(await window.api.addCard(deckId, newTitle, newCue, newGoals)); setNewTitle(''); setNewCue(''); setNewGoals(['', '', '', '']) }) }}><h3>カードを追加</h3><div className="form-grid"><label>カード名<input required maxLength={60} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="カード名"/></label><label>始めるきっかけ<input maxLength={120} value={newCue} onChange={e => setNewCue(e.target.value)} placeholder="任意"/></label></div><div className="goal-inputs">{newGoals.map((goal, i) => <label key={i}>Lv {i + 1}<input value={goal} maxLength={120} onChange={e => setNewGoals(newGoals.map((g, j) => j === i ? e.target.value : g))} placeholder="目安"/></label>)}</div><button className="primary-button" disabled={busy || !deckId || !newTitle.trim()}>追加する</button></form>
        </section>
      </div>
    </main>}
  </div>
}
