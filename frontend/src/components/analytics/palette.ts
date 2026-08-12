/**
 * Chart palette — validated, not chosen by eye.
 *
 * Run against the white card surface with the data-viz validator:
 *
 *   4 series, adjacent pairs  → ALL PASS
 *     CVD    worst #eda100↔#1baf7a  ΔE 9.1 (protan)   [≥8 target]
 *     normal worst #eda100↔#1baf7a  ΔE 22.9           [≥15 floor]
 *   3 series, all pairs (scatter, version bars) → ALL PASS
 *     CVD    worst #1baf7a↔#eb6834  ΔE 9.2 (deutan)
 *     normal worst #1baf7a↔#2a78d6  ΔE 24.0
 *
 * One WARN carried deliberately: aqua (2.82:1) and yellow (2.17:1) sit below
 * 3:1 on white. The documented relief is visible labelling — every chart using
 * those two slots also carries direct labels or an exact-values table, so hue is
 * never the only way to read a value.
 *
 * Slots are assigned in fixed order and never cycled. A metric keeps its colour
 * across every chart on the page, so "faithfulness is the green one" stays true.
 */

export const SERIES = {
  correctness: '#2a78d6', // slot 1 — blue
  completeness: '#eb6834', // slot 2 — orange
  faithfulness: '#1baf7a', // slot 3 — aqua
  relevancy: '#eda100', // slot 4 — yellow
} as const

export const SERIES_ORDER = [
  'correctness',
  'completeness',
  'faithfulness',
  'relevancy',
] as const

export type MetricKey = (typeof SERIES_ORDER)[number]

/** Reserved for state, never reused as a series colour. Always paired with a label. */
export const STATUS = {
  good: '#0ca30c',
  warning: '#fab219',
  serious: '#ec835a',
  critical: '#d03b3b',
} as const

/** Single hue, light → dark. Sequential encoding only (magnitude). */
export const SEQUENTIAL = [
  '#cde2fb',
  '#9ec5f4',
  '#6da7ec',
  '#3987e5',
  '#256abf',
  '#184f95',
  '#0d366b',
] as const

/** Two hues that read as opposite, with a neutral — never a hue at the midpoint. */
export const DIVERGING = {
  negative: '#d03b3b',
  neutral: '#e8eaee',
  positive: '#2a78d6',
} as const

export const INK = {
  primary: '#16233a',
  secondary: '#4a5a72',
  muted: '#6b7c95',
  grid: '#d3e0ee',
  surface: '#ffffff',
} as const

export const AXIS = {
  fill: INK.muted,
  fontSize: 12,
  fontFamily: 'IBM Plex Mono, monospace',
}

export const TOOLTIP = {
  contentStyle: {
    background: INK.surface,
    border: '1px solid #b3c7dc',
    borderRadius: 6,
    fontSize: 13,
    boxShadow: '0 4px 12px rgba(22,35,58,0.10)',
  },
  labelStyle: { color: INK.primary, fontWeight: 600 },
  cursor: { fill: 'rgba(29,78,216,0.06)' },
}

/** Picks a sequential step for a 0–100 value. */
export function sequentialStep(value: number, min = 60, max = 100): string {
  const clamped = Math.min(max, Math.max(min, value))
  const ratio = (clamped - min) / (max - min || 1)
  const index = Math.round(ratio * (SEQUENTIAL.length - 1))
  return SEQUENTIAL[index]
}

/** Ink that stays readable on a given sequential step. */
export function inkOnSequential(value: number, min = 60, max = 100): string {
  const clamped = Math.min(max, Math.max(min, value))
  const ratio = (clamped - min) / (max - min || 1)
  return ratio > 0.55 ? '#ffffff' : INK.primary
}
