import { useEffect, useRef, type ReactNode } from 'react'
import { CrossIcon } from '../Icons'

/**
 * Accessible modal built on the native <dialog> element, which gives focus
 * trapping, Esc-to-close, and the top layer for free.
 *
 * Fixed three-part structure — header, scrolling body, footer — so every modal
 * in the app opens the same way and the dismiss control is always in the same
 * place. Colour is left to the content; the shell itself stays neutral.
 */
export function Modal({
  open,
  onClose,
  title,
  subtitle,
  width = 'lg',
  footer,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: string
  width?: 'md' | 'lg' | 'xl'
  /** Extra actions, rendered left of the Close button. */
  footer?: ReactNode
  children: ReactNode
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // Esc fires the dialog's own `close` event; keep React state in step.
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const maxWidth = { md: 'max-w-2xl', lg: 'max-w-4xl', xl: 'max-w-6xl' }[width]

  return (
    <dialog
      ref={ref}
      onClick={(event) => {
        // Clicking the backdrop (the dialog element itself) closes it.
        if (event.target === ref.current) onClose()
      }}
      // `m-auto` restores the centring a <dialog> normally gets for free:
      // Tailwind's preflight zeroes margins on every element, which strips the
      // UA's `margin: auto` and drops the dialog into the top-left corner.
      className={`m-auto max-h-[86vh] w-[92vw] ${maxWidth} overflow-hidden rounded-xl border border-line bg-surface p-0 text-ink shadow-2xl backdrop:bg-ink-deep/40 backdrop:backdrop-blur-sm`}
    >
      <div className="flex max-h-[86vh] flex-col">
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="font-display text-[18px] font-semibold text-ink">{title}</h2>
            {subtitle && <p className="mt-1 text-[14px] text-ink-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-ink-faint transition-colors duration-200 hover:bg-raised hover:text-ink"
          >
            <CrossIcon />
          </button>
        </header>

        <div className="grow overflow-y-auto px-5 py-4">{children}</div>

        <footer className="flex shrink-0 items-center justify-end gap-2 border-t border-line bg-raised px-5 py-3">
          {footer}
          <button
            type="button"
            onClick={onClose}
            className="min-h-9 cursor-pointer rounded-md bg-brand px-4 text-[14px] font-medium text-white transition-colors duration-200 hover:bg-brand-strong"
          >
            Close
          </button>
        </footer>
      </div>
    </dialog>
  )
}

/** Small ⓘ button used on table headers to open the "what is this?" modal. */
export function InfoButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="inline-flex h-4 w-4 cursor-pointer items-center justify-center rounded-full border border-current text-[10px] font-bold leading-none text-ink-faint transition-colors duration-200 hover:text-brand"
    >
      i
    </button>
  )
}

/** Monospace block for prompts and raw model output. */
export function CodeBlock({ children }: { children: ReactNode }) {
  return (
    <pre className="tabular max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink">
      {children}
    </pre>
  )
}

/** Section divider used inside modal bodies. */
export function ModalSection({
  title,
  meta,
  children,
}: {
  title: string
  meta?: string
  children: ReactNode
}) {
  return (
    <section className="border-t border-line pt-4 first:border-t-0 first:pt-0">
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
        {meta && <span className="tabular text-[13px] text-ink-faint">{meta}</span>}
      </header>
      {children}
    </section>
  )
}
