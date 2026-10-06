import { useEffect, useRef, useState } from 'react'
import type { Session } from '../appStore'
import { formatExp, formatTime } from '../format'
import { useI18n } from '../i18n'
import styles from './DayTimeline.module.css'

type Props = { sessions: Session[]; dayStart: number; dayEnd: number }

const clock = (time: number) => {
  const date = new Date(time)
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export function DayTimeline({ sessions, dayStart, dayEnd }: Props) {
  const { locale, t } = useI18n()
  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const zoomLabelRef = useRef<HTMLSpanElement>(null)
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null)
  const hoveredSession = sessions.find((session) => session.id === hoveredSessionId)

  useEffect(() => {
    const viewport = viewportRef.current
    const content = contentRef.current
    const zoomLabel = zoomLabelRef.current
    if (!viewport || !content || !zoomLabel) return
    let zoom = 1
    let targetZoom = 1
    let anchor = 0
    let pointer = 0
    let frame = 0

    const animate = () => {
      zoom += (targetZoom - zoom) * 0.2
      if (Math.abs(targetZoom - zoom) < 0.002) zoom = targetZoom
      content.style.width = `${zoom * 100}%`
      viewport.scrollLeft = anchor * viewport.clientWidth * zoom - pointer
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`
      frame = zoom === targetZoom ? 0 : requestAnimationFrame(animate)
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const unit =
        event.deltaMode === WheelEvent.DOM_DELTA_LINE
          ? 16
          : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
            ? viewport.clientWidth
            : 1
      if (event.shiftKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
        if (frame) cancelAnimationFrame(frame)
        frame = 0
        targetZoom = zoom
        viewport.scrollLeft += (event.deltaX || event.deltaY) * unit
        return
      }
      const nextZoom = Math.max(
        1,
        Math.min(16, targetZoom * Math.exp(-event.deltaY * unit * 0.002)),
      )
      if (nextZoom === targetZoom) return
      pointer = event.clientX - viewport.getBoundingClientRect().left
      anchor = (viewport.scrollLeft + pointer) / (viewport.clientWidth * zoom)
      targetZoom = nextZoom
      if (!frame) frame = requestAnimationFrame(animate)
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      viewport.removeEventListener('wheel', onWheel)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return (
    <div className={styles.timeline} aria-label={t('dayTimeline')}>
      <div className={styles.heading}>
        <span>{t('dayTimeline')}</span>
        <span ref={zoomLabelRef}>100%</span>
      </div>
      <div className={styles.viewport} ref={viewportRef}>
        <div className={styles.content} ref={contentRef}>
          <div className={styles.axis}>
            <span>00</span>
            <span>06</span>
            <span>12</span>
            <span>18</span>
            <span>24</span>
          </div>
          <div className={styles.track}>
            {sessions.map((session) => {
              const start = Math.max(dayStart, session.startedAt)
              const end = Math.min(dayEnd, session.endedAt ?? session.startedAt)
              const timeLabel = t('timelineEntry', {
                title: session.cardTitle,
                start: clock(start),
                end: end === dayEnd ? '24:00' : clock(end),
              })
              return (
                <button
                  className={styles.bar}
                  key={session.id}
                  type="button"
                  aria-label={timeLabel}
                  onMouseEnter={() => setHoveredSessionId(session.id)}
                  onMouseLeave={() => setHoveredSessionId(null)}
                  onFocus={() => setHoveredSessionId(session.id)}
                  onBlur={() => setHoveredSessionId(null)}
                  style={{
                    left: `${((start - dayStart) / (dayEnd - dayStart)) * 100}%`,
                    width: `${((end - start) / (dayEnd - dayStart)) * 100}%`,
                  }}
                />
              )
            })}
          </div>
        </div>
      </div>
      {hoveredSession && (
        <div className={styles.detail}>
          <strong>{hoveredSession.cardTitle}</strong>
          <span>
            {hoveredSession.deckName} · {clock(hoveredSession.startedAt)}–
            {clock(hoveredSession.endedAt ?? hoveredSession.startedAt)} ·{' '}
            {formatTime(hoveredSession.durationMs ?? 0)} · Lv {hoveredSession.level} · +
            {formatExp(hoveredSession.exp ?? 0, locale)} EXP
          </span>
        </div>
      )}
    </div>
  )
}
