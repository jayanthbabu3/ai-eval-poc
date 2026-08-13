import { useEffect, useId, useRef, useState, type ReactNode } from 'react'

/**
 * A small "what does this mean?" popover.
 *
 * Click rather than hover: hover-only tooltips are unreachable by keyboard and
 * on touch, and this content is an explanation people need to read rather than
 * glance at. Dismisses on Esc, on outside click, and on scroll — an explanation
 * left floating over a scrolled page is worse than none.
 */
export function InfoPopover({
  title,
  children,
  align = 'right',
  label = 'What does this mean?',
  tone = 'light',
}: {
  title: string
  children: ReactNode
  /** Which edge the panel hangs from. Use "left" for triggers near the right edge. */
  align?: 'left' | 'right'
  label?: string
  /** "dark" for triggers sitting on the dark hero band, where ink-on-white fails. */
  tone?: 'light' | 'dark'
}) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLSpanElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const onScroll = () => setOpen(false)

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors duration-200 ${
          open
            ? 'border-brand bg-brand text-white'
            : tone === 'dark'
              ? 'border-white/35 text-white/70 hover:border-white hover:text-white'
              : 'border-line-strong text-ink-faint hover:border-brand hover:text-brand'
        }`}
      >
        i
      </button>

      {open && (
        <span
          id={panelId}
          role="dialog"
          aria-label={title}
          className={`absolute top-7 z-30 w-[min(22rem,80vw)] rounded-lg border border-line bg-surface p-3 text-left shadow-[0_8px_24px_rgba(22,35,58,0.16)] ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <span className="block text-[14px] font-semibold text-ink">{title}</span>
          <span className="mt-1 block max-w-[46ch] text-[13px] leading-relaxed text-ink-muted">
            {children}
          </span>
        </span>
      )}
    </span>
  )
}
