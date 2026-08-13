import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/**
 * A small "what does this mean?" popover.
 *
 * Click rather than hover: hover-only tooltips are unreachable by keyboard and
 * on touch, and this content is an explanation people need to read rather than
 * glance at. Dismisses on Esc, on outside click, and on scroll — an explanation
 * left floating over a scrolled page is worse than none.
 *
 * The panel is portalled to the body and positioned fixed rather than absolutely
 * inside its trigger. Absolute positioning means any ancestor with `overflow`
 * clips it, and on a dashboard that is most of them — the KPI band clips its own
 * rounded corners, the evaluations table scrolls. Portalling removes the whole
 * class of bug instead of chasing each container.
 */
const PANEL_WIDTH = 352 // 22rem
const GAP = 8

export function InfoPopover({
  title,
  children,
  align = 'right',
  label = 'What does this mean?',
}: {
  title: string
  children: ReactNode
  /** Which edge the panel prefers to hang from; it flips if the viewport says so. */
  align?: 'left' | 'right'
  label?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null,
  )
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const panelId = useId()

  // Measured before paint, so the panel never appears at the wrong spot first.
  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const width = Math.min(PANEL_WIDTH, window.innerWidth - GAP * 2)
    const preferred = align === 'right' ? rect.right - width : rect.left
    const left = Math.min(Math.max(GAP, preferred), window.innerWidth - width - GAP)
    setPosition({ top: rect.bottom + GAP, left, width })
  }, [open, align])

  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return
      setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    // Closing on scroll keeps the panel from drifting away from its trigger,
    // which is cheaper and steadier than repositioning on every frame.
    const onDismiss = () => setOpen(false)

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onDismiss, true)
    window.addEventListener('resize', onDismiss)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onDismiss, true)
      window.removeEventListener('resize', onDismiss)
    }
  }, [open])

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
        className={`inline-flex h-[18px] w-[18px] shrink-0 cursor-pointer items-center justify-center rounded-full border text-[11px] font-bold leading-none transition-colors duration-200 ${
          open
            ? 'border-brand bg-brand text-white'
            : 'border-line-strong text-ink-faint hover:border-brand hover:text-brand'
        }`}
      >
        i
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-label={title}
            style={{ top: position.top, left: position.left, width: position.width }}
            className="fixed z-50 rounded-lg border border-line bg-surface p-3 text-left shadow-[0_12px_32px_rgba(22,35,58,0.20)]"
          >
            <p className="text-[14px] font-semibold text-ink">{title}</p>
            <div className="mt-1 text-[13px] leading-relaxed text-ink-muted">{children}</div>
          </div>,
          document.body,
        )}
    </>
  )
}
