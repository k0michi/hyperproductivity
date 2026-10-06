import { AppStore } from '../appStore'
import { useI18n } from '../i18n'
import { useWatcher } from '../store'
import { PressableButton } from './PressableButton'

type Props = {
  onChangeDeck: (id: string) => void
  run: (action: () => Promise<void>) => Promise<void>
}

export function DecksView({ onChangeDeck, run }: Props) {
  const store = useWatcher(AppStore)
  const { t } = useI18n()
  const { data, deckId, busy, newDeck, newTitle, newCue, newGoals } = store
  if (!data) return null
  const currentDeck = data.decks.find(deck => deck.id === deckId)

  return <main className="page-layout">
    <h1>{t('decks')}</h1>
    <div className="decks-layout">
      <section className="panel deck-list"><h2>{t('deckList')}</h2>{data.decks.map(deck => <button key={deck.id} className={deckId === deck.id ? 'deck-list-item chosen' : 'deck-list-item'} onClick={() => onChangeDeck(deck.id)}><span>{deck.name}</span><small>{t('cardsCount', { count: data.cards.filter(card => card.deckId === deck.id).length })}</small></button>)}
        <form onSubmit={event => { event.preventDefault(); void run(async () => { store.set({ data: await window.api.addDeck(newDeck), newDeck: '' }) }) }}><label className="field-label" htmlFor="deck-name">{t('newDeck')}</label><div className="inline-input"><input id="deck-name" value={newDeck} onChange={event => store.set({ newDeck: event.target.value })} placeholder={t('deckName')} maxLength={40}/><PressableButton size="compact" type="submit" disabled={busy || !newDeck.trim()}>{t('add')}</PressableButton></div></form>
      </section>
      <section className="panel cards-workshop"><h2>{currentDeck?.name ?? t('chooseDeck')}</h2><div className="mini-cards">{data.cards.filter(card => card.deckId === deckId).map(card => <div className="mini-card" key={card.id}><b>{card.title}</b><small>{card.cue}</small></div>)}</div>
        <form onSubmit={event => { event.preventDefault(); void run(async () => { store.set({ data: await window.api.addCard(deckId, newTitle, newCue, newGoals), newTitle: '', newCue: '', newGoals: ['', '', '', ''] }) }) }}><h3>{t('addCard')}</h3><div className="form-grid"><label>{t('cardTitle')}<input required maxLength={60} value={newTitle} onChange={event => store.set({ newTitle: event.target.value })} placeholder={t('cardTitle')}/></label><label>{t('cue')}<input maxLength={120} value={newCue} onChange={event => store.set({ newCue: event.target.value })} placeholder={t('optional')}/></label></div><div className="goal-inputs">{newGoals.map((goal, index) => <label key={index}>Lv {index + 1}<input value={goal} maxLength={120} onChange={event => store.set({ newGoals: newGoals.map((value, goalIndex) => goalIndex === index ? event.target.value : value) })} placeholder={t('goal')}/></label>)}</div><PressableButton type="submit" disabled={busy || !deckId || !newTitle.trim()}>{t('addAction')}</PressableButton></form>
      </section>
    </div>
  </main>
}
