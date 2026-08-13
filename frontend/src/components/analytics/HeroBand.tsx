import { Sparkline } from './charts'
import { useView } from './view'
import { InfoPopover } from '../ui/InfoPopover'
import { SERIES, STATUS } from './palette'

/**
 * The headline band — an executive summary, in the app's own white/blue/green.
 *
 * Deliberately not a dark gradient panel. Hierarchy here comes from type size
 * and from hairline rules between cells, the way a financial terminal or a
 * Stripe summary reads: one number far larger than the rest, everything else
 * quiet and aligned. Nested rounded boxes, glows and neon rings are the things
 * that make a dashboard look generated rather than designed, and they would
 * also break the one-palette rule the rest of the app follows.
 *
 * Every figure keeps its own ⓘ; the explanations are the ones from the original
 * KPI strip, because that copy was the part people found useful.
 */

function Delta({
  delta,
  higherIsBetter,
  unit = '',
}: {
  delta: number | null
  higherIsBetter: boolean
  unit?: string
}) {
  if (delta === null) return <span className="text-[12px] text-ink-faint">no prior period</span>
  if (Math.abs(delta) < 0.05) return <span className="tabular text-[12px] text-ink-faint">flat</span>
  const improved = higherIsBetter ? delta > 0 : delta < 0
  return (
    <span
      className="tabular text-[12px] font-semibold"
      style={{ color: improved ? STATUS.good : STATUS.critical }}
    >
      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
      {unit}
    </span>
  )
}

function verdictFor(score: number) {
  if (score >= 88) return { word: 'Healthy', className: 'bg-ok/12 text-ok ring-ok/25' }
  if (score >= 75) return { word: 'Watch closely', className: 'bg-accent/12 text-accent ring-accent/25' }
  return { word: 'At risk', className: 'bg-bad/12 text-bad ring-bad/25' }
}

export function HeroBand() {
  const { summary, previousSummary, spark, label, lengthDays, previousLabel } = useView()
  const delta = (pick: (value: typeof summary) => number) =>
    previousSummary === null ? null : pick(summary) - pick(previousSummary)
  const verdict = verdictFor(summary.avgScore)

  const stats = [
    {
      label: 'Pass rate',
      value: `${summary.passRate.toFixed(1)}%`,
      delta: delta((s) => s.passRate),
      higherIsBetter: true,
      unit: 'pp',
      spark: spark.passRate,
      colour: SERIES.faithfulness,
      info: 'The share of answers that reached our pass mark of 70 out of 100. "pp" means percentage points — a move from 96% to 98% is +2pp, not +2%.',
    },
    {
      label: 'Hallucination rate',
      value: `${summary.hallucinationRate.toFixed(1)}%`,
      delta: delta((s) => s.hallucinationRate),
      higherIsBetter: false,
      unit: 'pp',
      spark: spark.faithfulness,
      colour: SERIES.completeness,
      info: 'The share of answers that made a claim the retrieved documents did not support — in other words, the assistant made something up. Measured as faithfulness scoring below 0.70. This is the number to watch most closely: a made-up IT policy sends staff down the wrong path.',
    },
    {
      label: 'p95 latency',
      value: `${(summary.p95 / 1000).toFixed(2)}s`,
      delta: previousSummary === null ? null : (summary.p95 - previousSummary.p95) / 1000,
      higherIsBetter: false,
      unit: 's',
      spark: spark.p95,
      colour: SERIES.relevancy,
      info: 'p95 means the 95th percentile: 95 out of every 100 answers came back faster than this, and 5 were slower. We show it instead of the average because an average is dragged down by the fast majority and hides the slow tail — and the slow answers are the ones users actually notice and complain about.',
    },
    {
      label: 'Spend',
      value: `$${summary.cost.toFixed(2)}`,
      delta: delta((s) => s.cost),
      higherIsBetter: false,
      spark: spark.cost,
      colour: SERIES.correctness,
      info: `Estimated spend on model calls over the selected ${lengthDays} days, covering both the assistant writing answers and the judge scoring them. The judge is usually the larger share, because it makes several calls per answer.`,
    },
    {
      label: 'Security blocks',
      value: String(summary.blocked),
      delta: delta((s) => s.blocked),
      higherIsBetter: false,
      spark: spark.passRate,
      colour: STATUS.critical,
      info: 'Answers stopped by a failed security check — a leaked credential, exposed personal data, or obeying an instruction hidden in a user question. These are blocked outright regardless of how well they scored elsewhere, because a good answer does not cancel out a data leak.',
    },
    {
      label: 'Judge–human agreement',
      value: `${summary.humanAgreement.toFixed(0)}%`,
      delta: delta((s) => s.humanAgreement),
      higherIsBetter: true,
      unit: 'pp',
      spark: spark.score,
      colour: SERIES.faithfulness,
      info: `How often the AI judge and a human reviewer put an answer on the same side of the pass mark, measured on the ${summary.reviewed} answers a person reviewed in this period. This is what justifies trusting the automated scores between human reviews. Below about 80% the judge would need recalibrating before anyone relied on it.`,
    },
  ]

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_1px_2px_rgba(22,35,58,0.05),0_10px_30px_-22px_rgba(22,35,58,0.45)]">
      <div className="grid lg:grid-cols-[minmax(260px,1fr)_2.2fr]">
        {/* The one number that outranks everything else on the page. */}
        <div className="border-b border-line p-5 lg:border-b-0 lg:border-r">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            Overall quality
            <InfoPopover title="Overall quality">
              The mean combined score across every answer in the selected period: rule checks 30%,
              the AI judge 40%, human review 30%. Useful as a headline, but an average hides shape
              — the distribution chart below shows whether 90 means “mostly 90”.
              {previousLabel
                ? ` The comparison is against ${previousLabel}, the same number of days immediately before.`
                : ' There is no equal-length period before this one in the sample data, so no comparison is shown.'}
            </InfoPopover>
          </p>

          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="tabular font-display text-[54px] font-bold leading-none tracking-tight text-ink">
              {summary.avgScore.toFixed(1)}
            </span>
            <span className="text-[14px] text-ink-faint">out of 100</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ${verdict.className}`}
            >
              {verdict.word}
            </span>
          </div>

          {/* A track with the pass mark on it says more than a ring: it shows
              both the value and the bar it has to clear. */}
          <div className="relative mt-4 mb-8" aria-hidden>
            <div className="h-1.5 rounded-full bg-raised">
              <div
                className="h-1.5 rounded-full bg-brand"
                style={{ width: `${Math.min(100, Math.max(0, summary.avgScore))}%` }}
              />
            </div>
            <span className="absolute -top-1 h-3.5 w-px bg-ink-muted" style={{ left: '70%' }} />
            <span
              className="tabular absolute top-4 -translate-x-1/2 whitespace-nowrap text-[11px] text-ink-faint"
              style={{ left: '70%' }}
            >
              pass mark 70
            </span>
          </div>

          <dl className="mt-4 space-y-1 text-[13px]">
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Answers evaluated</dt>
              <dd className="tabular font-medium text-ink">
                {summary.count.toLocaleString()} over {lengthDays} days
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">Period</dt>
              <dd className="tabular text-ink">{label}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-ink-muted">vs previous</dt>
              <dd>
                <Delta delta={delta((s) => s.avgScore)} higherIsBetter />
              </dd>
            </div>
          </dl>
        </div>

        {/* Hairline-separated cells rather than nested cards — the chrome of a
            card inside a card is what makes a KPI strip look cheap. */}
        {/* gap-px over a line-coloured ground draws the rules, so they stay
            correct however the grid rewraps — per-cell border classes do not. */}
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-surface p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-ink-muted">
                  {stat.label}
                </p>
                <InfoPopover title={stat.label} align="left">
                  {stat.info}
                </InfoPopover>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-2">
                <p className="tabular text-[24px] font-semibold leading-none text-ink">
                  {stat.value}
                </p>
                <Delta delta={stat.delta} higherIsBetter={stat.higherIsBetter} unit={stat.unit} />
              </div>
              <div className="mt-2">
                <Sparkline data={stat.spark} colour={stat.colour} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
