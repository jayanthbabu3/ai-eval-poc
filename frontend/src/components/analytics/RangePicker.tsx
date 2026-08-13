import {
  DAYS,
  FIRST_DATE,
  LAST_DATE,
  dateFor,
  dayIndexOf,
  lastNDays,
  rangeLength,
} from './data'
import { useAnalytics } from './view'

const DEFAULT_START = DAYS - 30

const PRESETS = [
  { days: 7, label: '7 days' },
  { days: 14, label: '14 days' },
  { days: 30, label: '30 days' },
  { days: DAYS, label: `All ${DAYS} days` },
]

/**
 * The single period control for the whole tab.
 *
 * Presets cover the common asks; the two date fields exist because the first
 * question anyone asks of a dashboard is "show me the week that went wrong",
 * and a fixed set of presets cannot answer it. The caption states the resolved
 * dates in words so nobody has to infer what "last 30 days" resolved to.
 */
export function RangePicker() {
  const { view, range, setRange } = useAnalytics()
  const activePreset = PRESETS.find(
    (preset) =>
      range.endDay === DAYS - 1 && rangeLength(range) === Math.min(preset.days, DAYS),
  )

  const setStart = (iso: string) => {
    const startDay = Math.min(dayIndexOf(iso), range.endDay)
    setRange({ ...range, startDay })
  }
  const setEnd = (iso: string) => {
    const endDay = Math.max(dayIndexOf(iso), range.startDay)
    setRange({ ...range, endDay })
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3 shadow-[0_1px_2px_rgba(22,35,58,0.05)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <span className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted">
          Period
        </span>

        <div className="flex flex-wrap gap-1" role="group" aria-label="Preset periods">
          {PRESETS.map((preset) => {
            const active = activePreset?.days === preset.days
            return (
              <button
                key={preset.days}
                type="button"
                aria-pressed={active}
                onClick={() => setRange(lastNDays(preset.days))}
                className={`min-h-9 cursor-pointer rounded-md border px-2.5 text-[14px] font-medium transition-colors duration-200 ${
                  active
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface text-ink-muted hover:border-brand hover:text-brand'
                }`}
              >
                {preset.label}
              </button>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <label className="text-[13px] text-ink-muted" htmlFor="range-start">
            From
          </label>
          <input
            id="range-start"
            type="date"
            value={dateFor(range.startDay)}
            min={FIRST_DATE}
            max={LAST_DATE}
            onChange={(event) => setStart(event.target.value)}
            className="tabular min-h-9 rounded-md border border-line bg-surface px-2 text-[14px] text-ink"
          />
          <label className="text-[13px] text-ink-muted" htmlFor="range-end">
            to
          </label>
          <input
            id="range-end"
            type="date"
            value={dateFor(range.endDay)}
            min={FIRST_DATE}
            max={LAST_DATE}
            onChange={(event) => setEnd(event.target.value)}
            className="tabular min-h-9 rounded-md border border-line bg-surface px-2 text-[14px] text-ink"
          />
        </div>

        {(range.startDay !== DEFAULT_START || range.endDay !== DAYS - 1) && (
          <button
            type="button"
            onClick={() => setRange(lastNDays(30))}
            className="min-h-9 cursor-pointer rounded-md px-2 text-[13px] font-medium text-brand underline-offset-2 hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      <p className="mt-2 text-[14px] text-ink-muted">
        Showing <strong className="text-ink">{view.label}</strong> —{' '}
        <span className="tabular">{view.lengthDays}</span> days,{' '}
        <span className="tabular">{view.summary.count.toLocaleString()}</span> answers.{' '}
        {view.previousLabel ? (
          <>
            Every “vs previous” figure compares against{' '}
            <span className="tabular">{view.previousLabel}</span>, the same number of days
            immediately before.
          </>
        ) : (
          <>
            No equal-length period before this one exists in the sample data, so comparison
            figures are hidden rather than computed against a shorter window.
          </>
        )}
      </p>

      <p className="mt-1 text-[13px] text-ink-faint">
        Every card, chart and table below obeys this one period. Sample data runs{' '}
        <span className="tabular">
          {FIRST_DATE} to {LAST_DATE}
        </span>
        .
      </p>
    </div>
  )
}
