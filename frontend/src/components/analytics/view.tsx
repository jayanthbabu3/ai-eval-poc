import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { buildView, lastNDays, type AnalyticsView, type Range } from './data'

/**
 * One selected date range for the whole Analytics tab.
 *
 * Every card reads from here, so there is exactly one answer to "what period am
 * I looking at?". Before this existed the KPI tiles covered seven days while the
 * trend chart covered thirty, which is the fastest way to lose an audience.
 */
interface AnalyticsContextValue {
  view: AnalyticsView
  range: Range
  setRange: (range: Range) => void
}

const AnalyticsContext = createContext<AnalyticsContextValue | null>(null)

/** Default view: the last 30 days, which always has a full previous 30 to compare with. */
export const DEFAULT_RANGE = lastNDays(30)

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [range, setRange] = useState<Range>(DEFAULT_RANGE)
  const view = useMemo(() => buildView(range), [range])
  const value = useMemo(() => ({ view, range, setRange }), [view, range])

  return <AnalyticsContext.Provider value={value}>{children}</AnalyticsContext.Provider>
}

export function useAnalytics(): AnalyticsContextValue {
  const value = useContext(AnalyticsContext)
  if (!value) throw new Error('useAnalytics must be used inside <AnalyticsProvider>')
  return value
}

/** Convenience for the many components that only need the derived data. */
export function useView(): AnalyticsView {
  return useAnalytics().view
}
