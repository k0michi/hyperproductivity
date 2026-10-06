import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

const B = 10 // Prototype values; DESIGN.md leaves B and a open.
const A = 8
let db: DatabaseSync

type Card = { id: string; deckId: string; title: string; cue: string; goals: string[]; weight: number }
type Deck = { id: string; name: string; color: string }
type Session = { id: string; deckId: string; cardId: string; deckName: string; cardTitle: string; startedAt: number; endedAt: number | null; durationMs: number | null; level: number | null; exp: number | null; localDate: string; note: string }

function uid(): string { return crypto.randomUUID() }
function localDate(timestamp: number): string {
  const d = new Date(timestamp)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function record(type: string, deckId: string | null, cardId: string | null, sessionId: string | null, data: object = {}): void {
  db.prepare('INSERT INTO events (id, type, at, deck_id, card_id, session_id, data) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(uid(), type, Date.now(), deckId, cardId, sessionId, JSON.stringify(data))
}
function allDecks(): Deck[] { return db.prepare('SELECT id, name, color FROM decks ORDER BY rowid').all() as Deck[] }
function allCards(): Card[] {
  return (db.prepare('SELECT id, deck_id AS deckId, title, cue, goals, weight FROM cards ORDER BY rowid').all() as Array<Omit<Card, 'goals'> & { goals: string }>).map(c => ({ ...c, goals: JSON.parse(c.goals) as string[] }))
}
function allSessions(): Session[] {
  return db.prepare(`SELECT id, deck_id AS deckId, card_id AS cardId, deck_name AS deckName,
    card_title AS cardTitle, started_at AS startedAt, ended_at AS endedAt,
    duration_ms AS durationMs, level, exp, local_date AS localDate, note
    FROM sessions ORDER BY started_at DESC`).all() as Session[]
}
function snapshot() {
  return { decks: allDecks(), cards: allCards(), sessions: allSessions(), totalExp: (db.prepare('SELECT COALESCE(SUM(exp), 0) AS total FROM sessions').get() as { total: number }).total, formula: { b: B, a: A, p: 0.5 } }
}
function setupDatabase(): void {
  db = new DatabaseSync(join(app.getPath('userData'), 'hyperproductivity.sqlite'))
  db.exec(`PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS decks (id TEXT PRIMARY KEY, name TEXT NOT NULL, color TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cards (id TEXT PRIMARY KEY, deck_id TEXT NOT NULL REFERENCES decks(id), title TEXT NOT NULL, cue TEXT NOT NULL, goals TEXT NOT NULL, weight REAL NOT NULL DEFAULT 1, skips INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, deck_id TEXT NOT NULL, card_id TEXT NOT NULL, deck_name TEXT NOT NULL, card_title TEXT NOT NULL, started_at INTEGER NOT NULL, ended_at INTEGER, duration_ms INTEGER, level INTEGER, exp REAL, local_date TEXT NOT NULL, note TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS events (id TEXT PRIMARY KEY, type TEXT NOT NULL, at INTEGER NOT NULL, deck_id TEXT, card_id TEXT, session_id TEXT, data TEXT NOT NULL);`)
  if ((db.prepare('SELECT COUNT(*) AS n FROM decks').get() as { n: number }).n === 0) {
    const decks: Array<Deck & { cards: Array<[string, string, string[]]> }> = [
      { id: uid(), name: 'まずは動く', color: '#a7dbb3', cards: [
        ['机を整える', '目の前を少しだけ軽くしよう', ['机に手を伸ばす', 'ひとつ片付ける', '作業面を整える', '気持ちよく使える状態にする']],
        ['気になることを読む', 'ひとつのページから始めよう', ['ページを開く', '一段落読む', '要点を見つける', '読んだことをまとめる']],
        ['アイデアを一行書く', 'どんな言葉でも大丈夫', ['メモを開く', '一行書く', '少し広げる', '形になるまで書いてみる']]
      ] },
      { id: uid(), name: 'からだを動かす', color: '#f0bc83', cards: [
        ['少し歩く', '立ち上がるところから', ['立ち上がる', '部屋を歩く', '外を歩く', '気の向くまま歩き続ける']],
        ['軽くストレッチ', '肩の力を抜こう', ['姿勢を変える', 'ひとつ伸ばす', '全身をほぐす', 'ゆっくり動きを続ける']]
      ] }
    ]
    for (const deck of decks) {
      db.prepare('INSERT INTO decks VALUES (?, ?, ?)').run(deck.id, deck.name, deck.color)
      for (const [title, cue, goals] of deck.cards) db.prepare('INSERT INTO cards (id, deck_id, title, cue, goals) VALUES (?, ?, ?, ?, ?)').run(uid(), deck.id, title, cue, JSON.stringify(goals))
    }
  }
}
function chooseCard(deckId: string, excludeId?: string): Card | null {
  const cards = allCards().filter(c => c.deckId === deckId)
  if (!cards.length) return null
  const pool = cards.length > 1 ? cards.filter(c => c.id !== excludeId) : cards
  const total = pool.reduce((sum, c) => sum + c.weight, 0)
  let pick = Math.random() * total
  const selected = pool.find(c => (pick -= c.weight) <= 0) ?? pool[pool.length - 1]
  record('presented', deckId, selected.id, null, { title: selected.title })
  return selected
}
function createWindow(): void {
  const window = new BrowserWindow({ width: 1180, height: 830, minWidth: 780, minHeight: 650, backgroundColor: '#151b2b', webPreferences: { preload: join(__dirname, '../preload/index.mjs'), contextIsolation: true, nodeIntegration: false, sandbox: false } })
  if (process.env.ELECTRON_RENDERER_URL) void window.loadURL(process.env.ELECTRON_RENDERER_URL)
  else void window.loadFile(join(__dirname, '../renderer/index.html'))
}
app.setAppUserModelId('com.koyomiji.hyperproductivity')

void app.whenReady().then(() => {
  setupDatabase()
  ipcMain.handle('state', () => snapshot())
  ipcMain.handle('draw', (_event, deckId: string, excludeId?: string) => chooseCard(deckId, excludeId))
  ipcMain.handle('skip', (_event, cardId: string) => {
    const card = allCards().find(c => c.id === cardId)
    if (!card) return null
    db.prepare('UPDATE cards SET skips = skips + 1, weight = MAX(0.2, weight * 0.75) WHERE id = ?').run(cardId)
    record('skipped', card.deckId, cardId, null)
    return chooseCard(card.deckId, cardId)
  })
  ipcMain.handle('start', (_event, cardId: string) => {
    const existing = db.prepare('SELECT id FROM sessions WHERE ended_at IS NULL LIMIT 1').get() as { id: string } | undefined
    if (existing) return existing.id
    const card = allCards().find(c => c.id === cardId)
    if (!card) throw new Error('Card not found')
    const deck = allDecks().find(d => d.id === card.deckId)!
    const id = uid(); const now = Date.now()
    db.prepare('INSERT INTO sessions (id, deck_id, card_id, deck_name, card_title, started_at, local_date) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, deck.id, card.id, deck.name, card.title, now, localDate(now))
    record('started', deck.id, card.id, id, { title: card.title })
    return id
  })
  ipcMain.handle('finish', (_event, sessionId: string, note: string) => {
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) as { deck_id: string; card_id: string; started_at: number; ended_at: number | null } | undefined
    if (!session) throw new Error('Session not found')
    if (session.ended_at !== null) return snapshot()
    const now = Date.now(); const duration = Math.max(0, now - session.started_at); const minutes = duration / 60000
    const level = minutes >= 45 ? 4 : minutes >= 15 ? 3 : minutes >= 3 ? 2 : 1
    const exp = B + A * Math.sqrt(minutes)
    db.exec('BEGIN')
    try {
      db.prepare('UPDATE sessions SET ended_at = ?, duration_ms = ?, level = ?, exp = ?, note = ? WHERE id = ? AND ended_at IS NULL')
        .run(now, duration, level, exp, note.trim().slice(0, 1000), sessionId)
      record('finished', session.deck_id, session.card_id, sessionId, { durationMs: duration })
      record('level_awarded', session.deck_id, session.card_id, sessionId, { level })
      record('exp_awarded', session.deck_id, session.card_id, sessionId, { exp, b: B, a: A, p: 0.5 })
      db.exec('COMMIT')
    } catch (error) { db.exec('ROLLBACK'); throw error }
    return snapshot()
  })
  ipcMain.handle('save-note', (_event, sessionId: string, note: string) => {
    const session = db.prepare('SELECT deck_id, card_id, note FROM sessions WHERE id = ?').get(sessionId) as { deck_id: string; card_id: string; note: string } | undefined
    if (!session) throw new Error('Session not found')
    const savedNote = note.slice(0, 1000)
    if (savedNote !== session.note) {
      db.exec('BEGIN')
      try {
        db.prepare('UPDATE sessions SET note = ? WHERE id = ?').run(savedNote, sessionId)
        record('note_updated', session.deck_id, session.card_id, sessionId, { note: savedNote })
        db.exec('COMMIT')
      } catch (error) { db.exec('ROLLBACK'); throw error }
    }
    return snapshot()
  })
  ipcMain.handle('add-deck', (_event, name: string) => {
    const trimmed = name.trim().slice(0, 40); if (!trimmed) throw new Error('Deck name is required')
    const id = uid(); db.prepare('INSERT INTO decks VALUES (?, ?, ?)').run(id, trimmed, '#b8a6e8')
    return snapshot()
  })
  ipcMain.handle('add-card', (_event, deckId: string, title: string, cue: string, goals: string[]) => {
    const trimmed = title.trim().slice(0, 60)
    if (!trimmed || !allDecks().some(d => d.id === deckId)) throw new Error('A valid deck and card title are required')
    const id = uid()
    db.prepare('INSERT INTO cards (id, deck_id, title, cue, goals) VALUES (?, ?, ?, ?, ?)').run(id, deckId, trimmed, cue.trim().slice(0, 120), JSON.stringify(goals.map(g => g.trim().slice(0, 120))))
    return snapshot()
  })
  createWindow()
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow() })
})
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
