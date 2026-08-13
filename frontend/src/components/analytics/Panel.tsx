import type { ReactNode } from 'react'
import { InfoPopover } from '../ui/InfoPopover'

/**
 * A bento tile.
 *
 * Deliberately lighter chrome than the shared `Card`: no filled header band, a
 * hairline rule instead, and a colour dot tying the tile to the series it plots.
 * Twelve identical full-width cards read as a form; varying the tile area is
 * what makes a dashboard scannable, because area is the first thing the eye
 * reads as importance.
 *
 * `span` is the column count on the 12-column grid at xl and above. Below that
 * everything stacks, which is the only sane behaviour for charts on a laptop.
 */
const SPAN: Record<number, string> = {
  3: 'xl:col-span-3',
  4: 'xl:col-span-4',
  5: 'xl:col-span-5',
  6: 'xl:col-span-6',
  7: 'xl:col-span-7',
  8: 'xl:col-span-8',
  12: 'xl:col-span-12',
}

export function Panel({
  title,
  step,
  meta,
  info,
  infoTitle,
  accent,
  span = 12,
  footer,
  children,
  bodyClassName = '',
}: {
  title: string
  /** Numbered badge, so a demo audience can follow the order without being told. */
  step?: number
  /** Small right-aligned context — usually the resolved date range. */
  meta?: ReactNode
  info?: ReactNode
  infoTitle?: string
  /** Hex of the series this tile is mostly about. Renders as a dot beside the title. */
  accent?: string
  span?: 3 | 4 | 5 | 6 | 7 | 8 | 12
  footer?: ReactNode
  children: ReactNode
  bodyClassName?: string
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(22,35,58,0.05),0_8px_24px_-16px_rgba(22,35,58,0.30)] transition-shadow duration-200 hover:shadow-[0_1px_2px_rgba(22,35,58,0.05),0_14px_32px_-16px_rgba(22,35,58,0.38)] ${SPAN[span]}`}
    >
      <header className="mb-3 flex items-start justify-between gap-3 border-b border-line pb-2.5">
        <div className="flex min-w-0 items-center gap-2">
          {step !== undefined && (
            <span className="tabular flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-brand-soft text-[11px] font-bold text-brand">
              {step}
            </span>
          )}
          {accent && (
            <span
              aria-hidden
              className="h-2 w-2 shrink-0 rounded-full"
              style={{ background: accent }}
            />
          )}
          <h2 className="truncate font-display text-[15px] font-semibold tracking-tight text-ink">
            {title}
          </h2>
          {info && (
            <InfoPopover title={infoTitle ?? title} align="left">
              {info}
            </InfoPopover>
          )}
        </div>
        {meta && (
          <span className="shrink-0 text-right text-[12px] leading-tight text-ink-faint">
            {meta}
          </span>
        )}
      </header>

      <div className={`min-w-0 flex-1 ${bodyClassName}`}>{children}</div>

      {footer && <div className="mt-3 border-t border-line pt-2.5">{footer}</div>}
    </section>
  )
}

/** A quiet rule that names the group of tiles beneath it. */
export function SectionLabel({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="col-span-full flex items-baseline gap-3 pt-2">
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
        {children}
      </h3>
      {hint && <p className="truncate text-[13px] text-ink-faint">{hint}</p>}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}
