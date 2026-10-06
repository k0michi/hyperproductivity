import { useState, type ButtonHTMLAttributes } from 'react'
import styles from './PressableButton.module.css'

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: 'large' | 'compact'
  tone?: 'default' | 'danger'
}

export function PressableButton({ size = 'large', tone = 'default', className = '', disabled, children, onPointerDown, onPointerUp, onPointerCancel, onPointerLeave, onKeyDown, onKeyUp, onBlur, type = 'button', ...rest }: Props) {
  const [pressed, setPressed] = useState(false)
  return <button
    {...rest}
    type={type}
    disabled={disabled}
    className={`${styles['pressable-button']} ${styles[`pressable-button--${size}`]} ${tone === 'danger' ? styles['pressable-button--danger'] : ''} ${className}`.trim()}
    data-pressed={pressed || undefined}
    onPointerDown={event => { if (!disabled) setPressed(true); onPointerDown?.(event) }}
    onPointerUp={event => { setPressed(false); onPointerUp?.(event) }}
    onPointerCancel={event => { setPressed(false); onPointerCancel?.(event) }}
    onPointerLeave={event => { setPressed(false); onPointerLeave?.(event) }}
    onKeyDown={event => { if (!disabled && (event.key === ' ' || event.key === 'Enter')) setPressed(true); onKeyDown?.(event) }}
    onKeyUp={event => { setPressed(false); onKeyUp?.(event) }}
    onBlur={event => { setPressed(false); onBlur?.(event) }}
  >{children}</button>
}
