import type { ReactNode } from 'react'
import { CheckIcon, CrossIcon } from './Icons'

/**
 * Section card with a tinted header bar.
 *
 * The header is a separate, shaded band rather than a heading floating on the
 * same white as the content: on a page of stacked panels that band is what
 * tells the eye where one section ends and the next begins. `step` adds a
 * numbered badge so a demo audience can follow the order without being told.
 */
export function Card({
  step,
  title,
  subtitle,
  action,
  children,
  className = '',
  bodyClassName = 'p-4',
}: {
  step?: number
  title?: string
  subtitle?: string
  action?: ReactNode
  children: ReactNode
  className?: string
  bodyClassName?: string
}) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-line bg-surface shadow-[0_1px_3px_0_rgba(45,48,65,0.08)] ${className}`}
    >
      {(title || action) && (
        <header className="flex items-start justify-between gap-3 border-b border-line bg-raised px-4 py-3">
          <div className="flex items-start gap-2.5">
            {step !== undefined && (
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                {step}
              </span>
            )}
            <div>
              {title && (
                <h2 className="font-display text-[17px] font-semibold text-ink">{title}</h2>
              )}
              {subtitle && <p className="mt-0.5 text-[14px] text-ink-muted">{subtitle}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  )
}

/** Status is never conveyed by colour alone — the word PASS/FAIL is always present. */
export function StatusPill({ passed, label }: { passed: boolean; label?: string }) {
  const text = label ?? (passed ? 'PASS' : 'FAIL')
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[13px] font-semibold tracking-wide ${
        passed
          ? 'bg-ok/15 text-ok ring-1 ring-ok/30'
          : 'bg-bad/15 text-bad ring-1 ring-bad/30'
      }`}
    >
      {passed ? <CheckIcon className="h-3 w-3" /> : <CrossIcon className="h-3 w-3" />}
      {text}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded bg-raised px-1.5 py-0.5 text-[13px] text-ink-muted ring-1 ring-line">
      {children}
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  disabled = false,
  type = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  variant?: 'primary' | 'ghost'
  disabled?: boolean
  type?: 'button' | 'submit'
}) {
  // Disabled uses a neutral fill, not a tinted brand: white-on-pale-blue is ~2:1.
  const styles =
    variant === 'primary'
      ? 'bg-brand text-white hover:bg-brand-strong disabled:bg-line disabled:text-ink-faint'
      : 'bg-raised text-ink ring-1 ring-line hover:bg-line disabled:text-ink-faint'
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      // min-h-11 keeps the 44px touch target from the accessibility rules.
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-md px-3 text-[15px] font-medium transition-colors duration-200 disabled:cursor-not-allowed ${styles}`}
    >
      {children}
    </button>
  )
}

export function Banner({
  tone,
  children,
}: {
  tone: 'info' | 'warn' | 'error'
  children: ReactNode
}) {
  const styles = {
    info: 'border-brand/40 bg-brand/10 text-brand-strong',
    warn: 'border-accent/40 bg-accent/10 text-accent',
    error: 'border-bad/40 bg-bad/10 text-bad',
  }[tone]
  return (
    <div className={`rounded-md border px-3 py-2 text-[15px] ${styles}`} role="status">
      {children}
    </div>
  )
}

export function EmptyState({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface/50 px-6 py-12 text-center">
      <p className="text-[15px] font-medium text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[14px] text-ink-muted">{hint}</p>
    </div>
  )
}
