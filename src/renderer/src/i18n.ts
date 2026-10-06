import { useEffect } from 'react'
import { AppStore, type Locale } from './appStore'
import { useReader, useSelector } from './store'

export const messages = {
  ja: {
    loading: '読み込み中', menu: 'メインメニュー', play: '行動', history: '記録', decks: 'デッキ',
    actionCard: '行動カード', inProgress: '取り組み中', completed: '完了',
    cardFeed: '行動カード。下にスクロールすると次のカード',
    completedFeed: '完了結果。下にスクロールすると次のカード',
    time: '時間', note: 'メモ', optional: '任意', reflectionPlaceholder: '振り返りを残す',
    progressPlaceholder: '途中の気づきを残す', freeGoal: '自由に取り組む', finish: '終了する', start: 'はじめる',
    noCards: 'カードがありません', addCardHint: 'デッキからカードを追加してください。', previous: '前回',
    actionHistory: '行動の記録', starts: '着手回数', dailyHistory: '日別の行動記録',
    daySummary: '{date}: {count}回 / {exp} EXP', dayAria: '{date} {count}回 {exp} EXP',
    count: '{count}回', cardsCount: '{count}枚', less: '少', more: '多', noRecords: '記録はありません',
    totalExp: '累計EXP', actionCount: '行動回数', deckList: 'デッキ一覧', newDeck: '新しいデッキ',
    deckName: 'デッキ名', add: '追加', chooseDeck: 'デッキを選択', addCard: 'カードを追加',
    cardTitle: 'カード名', cue: '始めるきっかけ', goal: '目安', addAction: '追加する',
    settings: '設定', language: '言語'
  },
  en: {
    loading: 'Loading', menu: 'Main menu', play: 'Actions', history: 'History', decks: 'Decks',
    actionCard: 'Action card', inProgress: 'In progress', completed: 'Complete',
    cardFeed: 'Action card. Scroll down for the next card',
    completedFeed: 'Completed action. Scroll down for the next card',
    time: 'Time', note: 'Note', optional: 'Optional', reflectionPlaceholder: 'Add a reflection',
    progressPlaceholder: 'Write down a thought', freeGoal: 'Work at your own pace', finish: 'Finish', start: 'Start',
    noCards: 'No cards yet', addCardHint: 'Add a card from the Decks screen.', previous: 'Previous',
    actionHistory: 'Action history', starts: 'Sessions started', dailyHistory: 'Daily action history',
    daySummary: '{date}: {count} sessions / {exp} EXP', dayAria: '{date} {count} sessions {exp} EXP',
    count: '{count} sessions', cardsCount: '{count} cards', less: 'Less', more: 'More', noRecords: 'No history yet',
    totalExp: 'Total EXP', actionCount: 'Action count', deckList: 'Deck list', newDeck: 'New deck',
    deckName: 'Deck name', add: 'Add', chooseDeck: 'Choose a deck', addCard: 'Add a card',
    cardTitle: 'Card title', cue: 'Starting cue', goal: 'Goal', addAction: 'Add card',
    settings: 'Settings', language: 'Language'
  }
} as const

export type { Locale } from './appStore'
export type MessageKey = keyof typeof messages.ja

export function useI18n() {
  const store = useReader(AppStore)
  const locale: Locale = useSelector(AppStore, current => current.locale)
  useEffect(() => { document.documentElement.lang = locale }, [locale])
  const setLocale = (value: Locale) => store.set({ locale: value })
  function t(key: MessageKey, values: Record<string, string | number> = {}): string {
    const template: string = messages[locale][key]
    return template.replace(/\{(\w+)\}/g, (_, name: string) => String(values[name] ?? `{${name}}`))
  }
  return { locale, setLocale, t }
}
