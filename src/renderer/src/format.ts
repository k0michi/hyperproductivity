import type { Locale } from './appStore'

export const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const formatTime = (ms: number) =>
  `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`
export const formatExp = (value: number, locale: Locale) =>
  value.toLocaleString(locale === 'ja' ? 'ja-JP' : 'en-US', { maximumFractionDigits: 1 })
export const formatDate = (key: string, locale: Locale) =>
  new Date(`${key}T00:00:00`).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
