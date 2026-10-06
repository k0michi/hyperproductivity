import { Store } from './store'

export type Locale = 'ja' | 'en'
export type Deck = { id: string; name: string; color: string }
export type Card = { id: string; deckId: string; title: string; cue: string; goals: string[]; weight: number }
export type Session = { id: string; deckId: string; cardId: string; deckName: string; cardTitle: string; startedAt: number; endedAt: number | null; durationMs: number | null; level: number | null; exp: number | null; localDate: string; note: string }
export type State = { decks: Deck[]; cards: Card[]; sessions: Session[]; totalExp: number; formula: { b: number; a: number; p: number } }
export type Tab = 'play' | 'history' | 'decks' | 'settings'
export type Motion = 'leaving' | 'entering' | ''

function initialLocale(): Locale {
  const saved = localStorage.getItem('locale')
  if (saved === 'ja' || saved === 'en') return saved
  return navigator.language.toLowerCase().startsWith('ja') ? 'ja' : 'en'
}

export class AppStore extends Store {
  locale: Locale = initialLocale()
  data: State | null = null
  tab: Tab = 'play'
  deckId = ''
  card: Card | null = null
  completedSessionId: string | null = null
  note = ''
  notice = ''
  busy = false
  motion: Motion = ''

  set(patch: Partial<Pick<AppStore, 'locale' | 'data' | 'tab' | 'deckId' | 'card' | 'completedSessionId' | 'note' | 'notice' | 'busy' | 'motion'>>): void {
    Object.assign(this, patch)
    if (patch.locale !== undefined) {
      localStorage.setItem('locale', patch.locale)
      document.documentElement.lang = patch.locale
    }
    this.notifyListeners()
  }
}
