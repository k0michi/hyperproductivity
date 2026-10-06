import { useState, type ButtonHTMLAttributes } from 'react'

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
    className={`pressable-button pressable-button--${size} pressable-button--${tone} ${className}`.trim()}
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
