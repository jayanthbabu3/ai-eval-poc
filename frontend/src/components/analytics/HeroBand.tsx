import { Sparkline } from './charts'
import { useView } from './view'
import { InfoPopover } from '../ui/InfoPopover'
import { SERIES, STATUS } from './palette'
import { COST_MODEL } from './data'

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
  const { summary, previousSummary, spark, lengthDays, previousLabel } = useView()
  const delta = (pick: (value: typeof summary) => number) =>
    previousSummary === null ? null : pick(summary) - pick(previousSummary)
  const verdict = verdictFor(summary.avgScore)
  const coverage = summary.count === 0 ? 0 : (summary.reviewed / summary.count) * 100

  const components = [
    {
      label: 'Rule checks',
      weight: '30%',
      value: summary.components.rules,
      colour: SERIES.faithfulness,
      note: `17 deterministic checks on every one of the ${summary.count.toLocaleString()} answers`,
    },
    {
      label: 'AI judge',
      weight: '40%',
      value: summary.components.judge,
      colour: SERIES.correctness,
      note: 'mean of correctness, completeness, faithfulness and relevancy',
    },
    {
      label: 'Human review',
      weight: '30%',
      value: summary.components.human,
      colour: SERIES.relevancy,
      note:
        summary.components.human === null
          ? 'nobody reviewed an answer in this period'
          : `${summary.reviewed} of ${summary.count.toLocaleString()} answers reviewed — ${coverage.toFixed(0)}% coverage`,
    },
  ]

  const stats = [
    {
      label: 'Pass rate',
      value: `${summary.passRate.toFixed(1)}%`,
      delta: delta((s) => s.passRate),
      higherIsBetter: true,
      unit: 'pp',
      spark: spark.passRate,
      colour: SERIES.faithfulness,
      note: 'blended final score 70+',
      fmt: (v: number) => `${v.toFixed(1)}%`,
      info: 'The share of answers that reached our pass mark of 70 out of 100. "pp" means percentage points — a move from 96% to 98% is +2pp, not +2%.',
    },
    {
      label: 'Hallucination rate',
      value: `${summary.hallucinationRate.toFixed(1)}%`,
      delta: delta((s) => s.hallucinationRate),
      higherIsBetter: false,
      unit: 'pp',
      spark: spark.hallucination,
      colour: SERIES.completeness,
      note: `${summary.hallucinated} of ${summary.count.toLocaleString()} answers`,
      fmt: (v: number) => `${v.toFixed(1)}%`,
      info: (
        <>
          <p>
            The assistant is only allowed to answer from the IT articles it retrieved. A
            hallucination is when it states something those articles never said — inventing a
            policy, a deadline, a portal name or a number that sounds entirely plausible.
          </p>
          <p className="mt-2">
            <strong>How we detect it.</strong> The judge takes each claim in the answer and looks
            for it in the retrieved articles, then returns a faithfulness score from 0 to 1. 1.00
            means every claim was traceable to a source. We count an answer as hallucinating below{' '}
            <strong>0.70</strong> — roughly a third of its claims could not be traced back.
          </p>
          <p className="mt-2">
            <strong>Right now.</strong> {summary.hallucinationRate.toFixed(1)}% means{' '}
            {summary.hallucinated} of {summary.count.toLocaleString()} answers made at least one
            unsupported claim.
          </p>
          <p className="mt-2">
            <strong>Why it matters most.</strong> A wrong answer about how long VPN approval takes
            sends someone down a path that does not exist, and nothing about the answer looks
            wrong — no error, no warning, same confident tone as a correct one. Every other number
            here measures how well the assistant did its job; this one measures whether it can be
            trusted at all.
          </p>
        </>
      ),
    },
    {
      label: 'p95 latency',
      value: `${(summary.p95 / 1000).toFixed(2)}s`,
      delta: previousSummary === null ? null : (summary.p95 - previousSummary.p95) / 1000,
      higherIsBetter: false,
      unit: 's',
      spark: spark.p95,
      colour: SERIES.relevancy,
      note: '19 in 20 answers were faster',
      fmt: (v: number) => `${(v / 1000).toFixed(1)}s`,
      info: 'p95 means the 95th percentile: 95 out of every 100 answers came back faster than this, and 5 were slower. We show it instead of the average because an average is dragged down by the fast majority and hides the slow tail — and the slow answers are the ones users actually notice and complain about.',
    },
    {
      label: 'Spend',
      value: `$${summary.cost.toFixed(2)}`,
      delta: delta((s) => s.cost),
      higherIsBetter: false,
      spark: spark.cost,
      colour: SERIES.correctness,
      note: `assistant $${summary.costAssistant.toFixed(2)} · judge $${summary.costJudge.toFixed(2)}`,
      fmt: (v: number) => `$${v.toFixed(2)}`,
      info: `Estimated spend on model calls over the selected ${lengthDays} days, priced at ${COST_MODEL.label} rates — $${COST_MODEL.inputPerMillion} per million input tokens and $${COST_MODEL.outputPerMillion} per million output. The assistant writing the answers cost $${summary.costAssistant.toFixed(2)}; the judge scoring them cost $${summary.costJudge.toFixed(2)}, because it makes one call per metric and each re-sends the question, the retrieved articles and the answer. Evaluation is the larger bill — that is the trade being made for the evidence on this page, and the reason you would sample the judge rather than run it on everything at high volume.`,
    },
    {
      label: 'Security blocks',
      value: String(summary.blocked),
      delta: delta((s) => s.blocked),
      higherIsBetter: false,
      spark: spark.blocked,
      colour: STATUS.critical,
      note: 'security rule veto, whatever the score',
      fmt: (v: number) => String(v),
      info: 'Answers stopped by a failed security check — a leaked credential, exposed personal data, or obeying an instruction hidden in a user question. These are blocked outright regardless of how well they scored elsewhere, because a good answer does not cancel out a data leak.',
    },
    {
      label: 'Judge–human agreement',
      value: `${summary.humanAgreement.toFixed(0)}%`,
      delta: delta((s) => s.humanAgreement),
      higherIsBetter: true,
      unit: 'pp',
      spark: spark.agreement,
      colour: SERIES.faithfulness,
      note: `${summary.reviewed} answers scored by both`,
      fmt: (v: number) => `${v.toFixed(0)}%`,
      sparkWindow: '7-day',
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
            <span className="flex items-center gap-1.5 text-[13px] text-ink-muted">
              vs previous <Delta delta={delta((s) => s.avgScore)} higherIsBetter />
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

          {/* The three scores the headline is blended from. Showing only the
              blend invites "where did 90.6 come from?" every single time. */}
          <div className="border-t border-line pt-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
              Blended from three scores
              <InfoPopover title="How the score is built" align="left">
                Every answer is scored three ways, each out of 100. <strong>Rule checks</strong> —
                how many of the 17 automated checks passed. <strong>AI judge</strong> — the mean
                of its four metrics. <strong>Human review</strong> — a reviewer’s 1–5 rubric
                converted to 100. The three are blended 30 / 40 / 30 to give the headline score.
                Only {coverage.toFixed(0)}% of answers were reviewed by a person, and an answer is
                never penalised for that: where a component is missing, the remaining weights are
                renormalised, so most answers here are scored 43% rules and 57% judge.
              </InfoPopover>
            </p>

            <ul className="mt-2 space-y-2">
              {components.map((component) => (
                <li key={component.label}>
                  <div className="flex items-baseline justify-between gap-2 text-[13px]">
                    <span className="text-ink">
                      {component.label}
                      <span className="tabular ml-1.5 text-[11px] text-ink-faint">
                        {component.weight}
                      </span>
                    </span>
                    <span className="tabular font-semibold text-ink">
                      {component.value === null ? '—' : component.value.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1 h-1 rounded-full bg-raised">
                    <div
                      className="h-1 rounded-full"
                      style={{
                        width: `${component.value ?? 0}%`,
                        background: component.colour,
                      }}
                    />
                  </div>
                  <p className="mt-0.5 text-[11px] text-ink-faint">{component.note}</p>
                </li>
              ))}
            </ul>
          </div>

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
              <div className="mt-3">
                <Sparkline
                  data={stat.spark}
                  colour={stat.colour}
                  height={56}
                  format={stat.fmt}
                  name={stat.sparkWindow === '7-day' ? '7-day average' : 'That day'}
                />
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-2 text-[12px] text-ink-faint">
                <span>{stat.note}</span>
                <span className="tabular shrink-0">
                  {stat.sparkWindow ?? 'daily'} {rangeOf(stat.spark, stat.fmt)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="border-t border-line px-4 py-2 text-[12px] text-ink-faint">
        Each small chart is one point per day across the selected period, with its own high and
        low printed beside it — the shape shows direction, the range shows how far it moved.
      </p>
    </section>
  )
}

/** High and low of a sparkline series, so the shape has a scale attached. */
function rangeOf(series: { v: number }[], format: (value: number) => string): string {
  if (series.length === 0) return '—'
  const values = series.map((point) => point.v)
  return `${format(Math.min(...values))}–${format(Math.max(...values))}`
}
