import type { Card, State } from './appStore'

export type Api = {
  state: () => Promise<State>
  draw: (deckId: string, excludeId?: string) => Promise<Card | null>
  skip: (cardId: string) => Promise<Card | null>
  start: (cardId: string) => Promise<string>
  finish: (sessionId: string, note: string) => Promise<State>
  saveNote: (sessionId: string, note: string) => Promise<State>
  addDeck: (name: string) => Promise<State>
  addCard: (deckId: string, title: string, cue: string, goals: string[]) => Promise<State>
}

declare global { interface Window { api: Api } }
