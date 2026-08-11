/** Formatting helpers. Every chart also renders its value as text, so these
 *  are the single source of truth for how a number reads across the UI. */

export const pct = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'n/a' : `${(value * 100).toFixed(1)}%`

export const score = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'n/a' : value.toFixed(2)

export const ms = (value: number | null | undefined): string =>
  value === null || value === undefined ? 'n/a' : `${Math.round(value)} ms`

export const timestamp = (iso: string): string => {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString()
}

export const titleCase = (value: string): string =>
  value.charAt(0).toUpperCase() + value.slice(1)
