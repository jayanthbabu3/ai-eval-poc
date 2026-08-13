import { Sparkline } from './charts'
import { useView } from './view'
import { InfoPopover } from '../ui/InfoPopover'

/**
 * The one tile that is not a card.
 *
 * A dashboard made only of white cards has no hierarchy — everything shouts at
 * the same volume. This dark band carries the single number a manager actually
 * asks for, at a size nothing else on the page competes with, and the six
 * supporting figures at a deliberately smaller weight beneath it.
 *
 * Every figure still carries its own ⓘ; the explanations moved here verbatim
 * from the old KPI strip rather than being rewritten, because they were the
 * part people found useful.
 */

/** Delta colours for the dark band only — always paired with an arrow and a number. */
const UP = '#6fe0a0'
const DOWN = '#ff9b9b'

function Delta({
  delta,
  higherIsBetter,
  unit = '',
}: {
  delta: number | null
  higherIsBetter: boolean
  unit?: string
}) {
  if (delta === null) return <span className="text-[12px] text-white/40">no prior period</span>
  if (Math.abs(delta) < 0.05) return <span className="tabular text-[12px] text-white/40">flat</span>
  const improved = higherIsBetter ? delta > 0 : delta < 0
  return (
    <span className="tabular text-[12px] font-semibold" style={{ color: improved ? UP : DOWN }}>
      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
      {unit}
    </span>
  )
}

function ScoreRing({ score }: { score: number }) {
  const radius = 58
  const circumference = 2 * Math.PI * radius
  const filled = (Math.min(100, Math.max(0, score)) / 100) * circumference

  return (
    <svg width="148" height="148" viewBox="0 0 148 148" role="img" aria-label={`Average score ${score.toFixed(1)} out of 100`}>
      <defs>
        <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#6aa9f5" />
          <stop offset="100%" stopColor="#4fe0b0" />
        </linearGradient>
      </defs>
      <circle cx="74" cy="74" r={radius} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="11" />
      <circle
        cx="74"
        cy="74"
        r={radius}
        fill="none"
        stroke="url(#ring)"
        strokeWidth="11"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform="rotate(-90 74 74)"
      />
      <text
        x="74"
        y="70"
        textAnchor="middle"
        fill="#ffffff"
        fontSize="34"
        fontWeight="600"
        fontFamily="IBM Plex Mono, monospace"
      >
        {score.toFixed(1)}
      </text>
      <text
        x="74"
        y="90"
        textAnchor="middle"
        fill="rgba(255,255,255,0.55)"
        fontSize="12"
        fontFamily="Inter, sans-serif"
      >
        out of 100
      </text>
    </svg>
  )
}

function verdictFor(score: number): { word: string; colour: string } {
  if (score >= 88) return { word: 'Healthy', colour: UP }
  if (score >= 75) return { word: 'Watch closely', colour: '#ffd166' }
  return { word: 'At risk', colour: DOWN }
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
      colour: '#4fe0b0',
      info: 'The share of answers that reached our pass mark of 70 out of 100. "pp" means percentage points — a move from 96% to 98% is +2pp, not +2%.',
    },
    {
      label: 'Hallucination rate',
      value: `${summary.hallucinationRate.toFixed(1)}%`,
      delta: delta((s) => s.hallucinationRate),
      higherIsBetter: false,
      unit: 'pp',
      spark: spark.faithfulness,
      colour: '#ff9b9b',
      info: 'The share of answers that made a claim the retrieved documents did not support — in other words, the assistant made something up. Measured as faithfulness scoring below 0.70. This is the number to watch most closely: a made-up IT policy sends staff down the wrong path.',
    },
    {
      label: 'p95 latency',
      value: `${(summary.p95 / 1000).toFixed(2)}s`,
      delta: previousSummary === null ? null : (summary.p95 - previousSummary.p95) / 1000,
      higherIsBetter: false,
      unit: 's',
      spark: spark.p95,
      colour: '#ffd166',
      info: 'p95 means the 95th percentile: 95 out of every 100 answers came back faster than this, and 5 were slower. We show it instead of the average because an average is dragged down by the fast majority and hides the slow tail — and the slow answers are the ones users actually notice and complain about.',
    },
    {
      label: 'Spend',
      value: `$${summary.cost.toFixed(2)}`,
      delta: delta((s) => s.cost),
      higherIsBetter: false,
      spark: spark.cost,
      colour: '#6aa9f5',
      info: `Estimated spend on model calls over the selected ${lengthDays} days, covering both the assistant writing answers and the judge scoring them. The judge is usually the larger share, because it makes several calls per answer.`,
    },
    {
      label: 'Security blocks',
      value: String(summary.blocked),
      delta: delta((s) => s.blocked),
      higherIsBetter: false,
      spark: spark.passRate,
      colour: '#ff9b9b',
      info: 'Answers stopped by a failed security check — a leaked credential, exposed personal data, or obeying an instruction hidden in a user question. These are blocked outright regardless of how well they scored elsewhere, because a good answer does not cancel out a data leak.',
    },
    {
      label: 'Judge–human agreement',
      value: `${summary.humanAgreement.toFixed(0)}%`,
      delta: delta((s) => s.humanAgreement),
      higherIsBetter: true,
      unit: 'pp',
      spark: spark.score,
      colour: '#4fe0b0',
      info: `How often the AI judge and a human reviewer put an answer on the same side of the pass mark, measured on the ${summary.reviewed} answers a person reviewed in this period. This is what justifies trusting the automated scores between human reviews. Below about 80% the judge would need recalibrating before anyone relied on it.`,
    },
  ]

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(135deg,#132038_0%,#1b3358_52%,#173f5f_100%)] p-5 text-white shadow-[0_18px_40px_-24px_rgba(19,32,56,0.9)]">
      {/* A single soft highlight. Depth on a flat fill is what separates a
          premium panel from a coloured rectangle. */}
      <span
        aria-hidden
        className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(111,224,160,0.22),transparent_68%)]"
      />

      <div className="relative grid gap-5 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex items-center gap-4">
          <ScoreRing score={summary.avgScore} />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/50">
              Overall quality
            </p>
            <p className="mt-1 font-display text-[22px] font-bold" style={{ color: verdict.colour }}>
              {verdict.word}
            </p>
            <p className="tabular mt-1.5 text-[14px] text-white/75">
              {summary.count.toLocaleString()} answers · {lengthDays} days
            </p>
            <p className="tabular text-[13px] text-white/45">{label}</p>
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-white/60">
              vs previous <Delta delta={delta((s) => s.avgScore)} higherIsBetter unit="" />
              <InfoPopover
                title="Overall quality"
                tone="dark"
                align="left"
              >
                The mean combined score across every answer in the selected period: rule checks
                30%, the AI judge 40%, human review 30%. Useful as a headline, but an average
                hides shape — the distribution chart below shows whether 90 means “mostly 90”.
                {previousLabel
                  ? ` The comparison is against ${previousLabel}, the same number of days immediately before.`
                  : ' There is no equal-length period before this one in the sample data, so no comparison is shown.'}
              </InfoPopover>
            </p>
          </div>
        </div>

        <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 xl:grid-cols-3">
          {stats.map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2.5 backdrop-blur-sm"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-[11px] font-medium uppercase tracking-[0.1em] text-white/55">
                  {stat.label}
                </p>
                <InfoPopover title={stat.label} tone="dark" align="left">
                  {stat.info}
                </InfoPopover>
              </div>
              <div className="mt-0.5 flex items-baseline justify-between gap-2">
                <p className="tabular text-[21px] font-semibold">{stat.value}</p>
                <Delta delta={stat.delta} higherIsBetter={stat.higherIsBetter} unit={stat.unit} />
              </div>
              <div className="mt-1 opacity-80">
                <Sparkline data={stat.spark} colour={stat.colour} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
