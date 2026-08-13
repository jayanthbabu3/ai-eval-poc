import { useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts'
import { AXIS, INK, SERIES, SERIES_ORDER, STATUS, TOOLTIP } from './palette'
import { dateFor, formatDate } from './data'
import { useView } from './view'

/** The x-axis category for a given day, so deploy markers land on the right tick. */
const dayLabel = (dayIndex: number) => formatDate(dateFor(dayIndex))

const METRIC_LABEL: Record<string, string> = {
  correctness: 'Correctness',
  completeness: 'Completeness',
  faithfulness: 'Faithfulness',
  relevancy: 'Relevancy',
}

/** Shared legend styling — identity is never carried by colour alone. */
const legendStyle = { fontSize: 13, color: INK.secondary, paddingTop: 8 }

// ---------------------------------------------------------------- sparkline

/** Tiny single-series trend for a KPI tile. One series, so no legend. */
export function Sparkline({ data, colour }: { data: { v: number }[]; colour: string }) {
  return (
    <ResponsiveContainer width="100%" height={32}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${colour.slice(1)}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colour} stopOpacity={0.28} />
            <stop offset="100%" stopColor={colour} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone"
          dataKey="v"
          stroke={colour}
          strokeWidth={2}
          fill={`url(#spark-${colour.slice(1)})`}
          isAnimationActive={false}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ----------------------------------------------------------- quality trend

/** Roughly eight readable ticks whatever the selected period length. */
const tickInterval = (points: number) => Math.max(0, Math.floor(points / 8))

/**
 * The chart that earns the dashboard. Four metrics across the selected period
 * with deploy markers, so a regression is visible rather than inferred.
 */
export function QualityTrend() {
  const view = useView()
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setHidden((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={view.days} margin={{ top: 24, right: 16, left: -18, bottom: 0 }}>
          <CartesianGrid stroke={INK.grid} vertical={false} />
          <XAxis
            dataKey="label"
            tick={AXIS}
            stroke={INK.grid}
            interval={tickInterval(view.days.length)}
          />
          <YAxis domain={[60, 100]} tick={AXIS} stroke={INK.grid} />
          <Tooltip
            {...TOOLTIP}
            formatter={(value, name) => [
              `${Number(value).toFixed(1)}`,
              METRIC_LABEL[String(name)] ?? String(name),
            ]}
          />

          {/* The degraded window, shaded so the eye lands on it first. */}
          {view.degraded && (
            <ReferenceArea
              x1={view.degraded.fromLabel}
              x2={view.degraded.toLabel}
              fill={STATUS.critical}
              fillOpacity={0.05}
            />
          )}

          {view.deploys.map((deploy) => (
            <ReferenceLine
              key={deploy.label}
              x={dayLabel(deploy.dayIndex)}
              stroke={deploy.kind === 'regression' ? STATUS.critical : INK.muted}
              strokeDasharray="4 3"
              label={{
                value: deploy.label,
                position: 'top',
                fill: deploy.kind === 'regression' ? STATUS.critical : INK.muted,
                fontSize: 12,
                fontFamily: 'IBM Plex Mono, monospace',
              }}
            />
          ))}

          <Legend
            wrapperStyle={legendStyle}
            onClick={(entry) => toggle(String(entry.dataKey))}
            formatter={(value) => (
              <span style={{ cursor: 'pointer' }}>{METRIC_LABEL[String(value)] ?? value}</span>
            )}
          />

          {SERIES_ORDER.map((key) => (
            <Line
              key={key}
              type="monotone"
              dataKey={key}
              name={key}
              stroke={SERIES[key]}
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: INK.surface }}
              hide={hidden.has(key)}
              isAnimationActive={false}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>

      <p className="mt-1 text-[13px] text-ink-faint">
        {view.days.length} days, {view.label}. Click a legend entry to isolate a metric.
        {view.degraded
          ? ' The shaded band is the period the regressed release was live.'
          : ' No release regression falls inside this period.'}
      </p>
    </>
  )
}

// ----------------------------------------------------------- distribution

/** Averages hide shape. A histogram shows whether 84 means "mostly 84". */
export function ScoreDistribution() {
  const { distribution } = useView()

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={distribution} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="bucket" tick={AXIS} stroke={INK.grid} interval={0} />
        <YAxis tick={AXIS} stroke={INK.grid} allowDecimals={false} />
        <Tooltip {...TOOLTIP} formatter={(value) => [`${value} answers`, 'Count']} />
        <ReferenceLine
          x="70-79"
          stroke={STATUS.warning}
          strokeDasharray="4 3"
          label={{ value: 'pass mark', position: 'top', fill: INK.secondary, fontSize: 12 }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]} isAnimationActive={false}>
          {distribution.map((entry) => (
            <Cell
              key={entry.bucket}
              fill={entry.low < 70 ? STATUS.critical : SERIES.correctness}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// -------------------------------------------------------------- failures

export function FailureBars({ onSelect }: { onSelect: (name: string) => void }) {
  const { failures } = useView()

  if (failures.length === 0) {
    return <p className="text-[14px] text-ink-muted">No rule check failed in this period.</p>
  }

  const worst = Math.max(...failures.map((entry) => entry.count))

  return (
    <ul className="space-y-1.5">
      {failures.map((failure) => {
        const isSecurity = failure.group === 'security'
        return (
          <li key={failure.raw}>
            <button
              type="button"
              onClick={() => onSelect(failure.raw)}
              className="group flex w-full cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors duration-200 hover:border-brand hover:bg-brand-soft"
            >
              <span className="tabular w-48 shrink-0 text-[14px] font-medium text-ink">
                {failure.name}
              </span>
              <span className="relative h-6 flex-1 overflow-hidden rounded bg-raised">
                <span
                  className="absolute inset-y-0 left-0 rounded"
                  style={{
                    width: `${(failure.count / worst) * 100}%`,
                    background: isSecurity ? STATUS.critical : SERIES.completeness,
                  }}
                />
              </span>
              <span className="tabular w-28 shrink-0 text-right text-[13px] text-ink-muted">
                {failure.count} · {failure.rate.toFixed(1)}%
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

// --------------------------------------------------------------- latency

/**
 * Percentile bands rather than an average line. The median is comfortable and
 * the tail is not — an average would hide exactly that.
 */
export function LatencyBands() {
  const { days } = useView()

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={days} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} stroke={INK.grid} interval={tickInterval(days.length)} />
        <YAxis tick={AXIS} stroke={INK.grid} unit="ms" width={64} />
        <Tooltip {...TOOLTIP} formatter={(value, name) => [`${value} ms`, String(name)]} />
        <Legend wrapperStyle={legendStyle} />
        <Area
          type="monotone"
          dataKey="p99"
          name="p99"
          stroke={SERIES.relevancy}
          fill={SERIES.relevancy}
          fillOpacity={0.14}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p95"
          name="p95"
          stroke={SERIES.completeness}
          fill={SERIES.completeness}
          fillOpacity={0.16}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Area
          type="monotone"
          dataKey="p50"
          name="p50 (median)"
          stroke={SERIES.correctness}
          fill={SERIES.correctness}
          fillOpacity={0.2}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

/** Cost is its own chart — never a second axis on the latency plot. */
export function CostTrend() {
  const { days } = useView()

  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={days} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="label" tick={AXIS} stroke={INK.grid} interval={tickInterval(days.length)} />
        <YAxis tick={AXIS} stroke={INK.grid} width={64} unit="$" />
        <Tooltip {...TOOLTIP} formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Spend']} />
        <Bar
          dataKey="costUsd"
          name="Daily spend"
          fill={SERIES.correctness}
          radius={[4, 4, 0, 0]}
          isAnimationActive={false}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}

// --------------------------------------------------------------- scatters

/** Does slower mean better? Colour is state here, so it uses status tokens. */
export function LatencyVsQuality() {
  const { latencyQuality } = useView()
  const groups = [
    { key: 'pass', label: 'Passed', colour: STATUS.good },
    { key: 'fail', label: 'Failed', colour: STATUS.serious },
    { key: 'blocked', label: 'Blocked', colour: STATUS.critical },
  ]

  return (
    <ResponsiveContainer width="100%" height={260}>
      <ScatterChart margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
        <CartesianGrid stroke={INK.grid} />
        <XAxis
          type="number"
          dataKey="latency"
          name="Latency"
          unit="ms"
          tick={AXIS}
          stroke={INK.grid}
        />
        <YAxis
          type="number"
          dataKey="score"
          name="Score"
          domain={[40, 100]}
          tick={AXIS}
          stroke={INK.grid}
        />
        <ZAxis range={[36, 36]} />
        <Tooltip {...TOOLTIP} cursor={{ strokeDasharray: '4 3' }} />
        <Legend wrapperStyle={legendStyle} />
        {groups.map((group) => (
          <Scatter
            key={group.key}
            name={group.label}
            data={latencyQuality.filter((point) => point.verdict === group.key)}
            fill={group.colour}
            fillOpacity={0.65}
            isAnimationActive={false}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  )
}

/**
 * Judge against human. The chart most dashboards omit and the one that decides
 * whether any of the automated numbers can be trusted.
 */
export function JudgeVsHuman() {
  const { agreementPoints } = useView()

  return (
    <>
      <ResponsiveContainer width="100%" height={342}>
        <ScatterChart margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
          <CartesianGrid stroke={INK.grid} />
          <XAxis
            type="number"
            dataKey="judge"
            name="Judge score"
            domain={[40, 100]}
            tick={AXIS}
            stroke={INK.grid}
          />
          <YAxis
            type="number"
            dataKey="human"
            name="Human score"
            domain={[40, 100]}
            tick={AXIS}
            stroke={INK.grid}
          />
          <ZAxis range={[40, 40]} />
          <Tooltip {...TOOLTIP} cursor={{ strokeDasharray: '4 3' }} />
          {/* Perfect agreement lies on this diagonal. */}
          <ReferenceLine
            segment={[
              { x: 40, y: 40 },
              { x: 100, y: 100 },
            ]}
            stroke={INK.muted}
            strokeDasharray="5 4"
          />
          <ReferenceLine x={70} stroke={STATUS.warning} strokeDasharray="3 3" />
          <ReferenceLine y={70} stroke={STATUS.warning} strokeDasharray="3 3" />
          <Scatter
            name="Reviewed answers"
            data={agreementPoints}
            fill={SERIES.correctness}
            fillOpacity={0.6}
            isAnimationActive={false}
          />
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-2 text-[13px] leading-relaxed text-ink-faint">
        Dots on the dashed diagonal are perfect agreement; the amber lines mark the pass
        threshold. Top-left is where the judge was harsher than a person; bottom-right is the
        dangerous quadrant, where the judge passed something a human would not.
      </p>
    </>
  )
}

// ----------------------------------------------------------------- profile

/** Selected period against the one before — two series, so a legend is required. */
export function MetricProfile() {
  const { summary, previousSummary, lengthDays, previousLabel } = useView()
  const data = SERIES_ORDER.map((key) => ({
    metric: METRIC_LABEL[key],
    current: Math.round(summary.metrics[key] * 10) / 10,
    previous: previousSummary ? Math.round(previousSummary.metrics[key] * 10) / 10 : null,
  }))

  return (
    <>
      <ResponsiveContainer width="100%" height={260}>
        <RadarChart data={data} outerRadius="70%">
          <PolarGrid stroke={INK.grid} />
          <PolarAngleAxis dataKey="metric" tick={{ ...AXIS, fontFamily: 'Inter, sans-serif' }} />
          <PolarRadiusAxis domain={[60, 100]} tick={AXIS} axisLine={false} />
          <Tooltip {...TOOLTIP} />
          <Legend wrapperStyle={legendStyle} />
          {previousSummary && (
            <Radar
              name={`Previous ${lengthDays} days`}
              dataKey="previous"
              stroke={INK.muted}
              fill={INK.muted}
              fillOpacity={0.1}
              strokeWidth={2}
              isAnimationActive={false}
            />
          )}
          <Radar
            name={`Selected ${lengthDays} days`}
            dataKey="current"
            stroke={SERIES.correctness}
            fill={SERIES.correctness}
            fillOpacity={0.2}
            strokeWidth={2}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Radar cannot be read precisely, and two of these hues sit under 3:1 on
          white — the exact numbers are the documented relief for both. */}
      <table className="mt-2 w-full text-left text-[14px]">
        <thead>
          <tr className="text-[12px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="py-1 font-medium">Metric</th>
            <th scope="col" className="py-1 font-medium">Selected</th>
            <th scope="col" className="py-1 font-medium">Previous</th>
            <th scope="col" className="py-1 font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {data.map((row) => {
            const delta = row.previous === null ? null : row.current - row.previous
            return (
              <tr key={row.metric} className="border-t border-line">
                <td className="py-1.5 text-ink">{row.metric}</td>
                <td className="py-1.5 text-ink">{row.current.toFixed(1)}</td>
                <td className="py-1.5 text-ink-muted">
                  {row.previous === null ? '—' : row.previous.toFixed(1)}
                </td>
                {delta === null ? (
                  <td className="py-1.5 text-ink-faint">no earlier period</td>
                ) : (
                  <td
                    className="py-1.5 font-semibold"
                    style={{ color: delta >= 0 ? STATUS.good : STATUS.critical }}
                  >
                    {delta >= 0 ? '+' : ''}
                    {delta.toFixed(1)}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      <p className="mt-1.5 text-[13px] text-ink-faint">
        {previousLabel ? `Previous period is ${previousLabel}.` : 'No earlier period of equal length exists in the sample data.'}
      </p>
    </>
  )
}

// -------------------------------------------------------------- versions

export function VersionComparison() {
  const { versions } = useView()

  if (versions.length < 2) {
    return (
      <p className="text-[14px] text-ink-muted">
        Only one release ran inside this period, so there is nothing to compare. Widen the date
        range to see releases side by side.
      </p>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={versions} margin={{ top: 8, right: 16, left: -18, bottom: 0 }}>
        <CartesianGrid stroke={INK.grid} vertical={false} />
        <XAxis dataKey="version" tick={AXIS} stroke={INK.grid} />
        <YAxis domain={[60, 100]} tick={AXIS} stroke={INK.grid} />
        <Tooltip
          {...TOOLTIP}
          formatter={(value, name) => [
            Number(value).toFixed(1),
            METRIC_LABEL[String(name)] ?? String(name),
          ]}
        />
        <Legend
          wrapperStyle={legendStyle}
          formatter={(value) => METRIC_LABEL[String(value)] ?? value}
        />
        {SERIES_ORDER.map((key) => (
          <Bar
            key={key}
            dataKey={key}
            name={key}
            fill={SERIES[key]}
            radius={[4, 4, 0, 0]}
            isAnimationActive={false}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}
