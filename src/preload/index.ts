import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  state: () => ipcRenderer.invoke('state'),
  draw: (deckId: string, excludeId?: string) => ipcRenderer.invoke('draw', deckId, excludeId),
  skip: (cardId: string) => ipcRenderer.invoke('skip', cardId),
  start: (cardId: string) => ipcRenderer.invoke('start', cardId),
  finish: (sessionId: string, note: string) => ipcRenderer.invoke('finish', sessionId, note),
  saveNote: (sessionId: string, note: string) => ipcRenderer.invoke('save-note', sessionId, note),
  addDeck: (name: string) => ipcRenderer.invoke('add-deck', name),
  addCard: (deckId: string, title: string, cue: string, goals: string[]) => ipcRenderer.invoke('add-card', deckId, title, cue, goals)
})
