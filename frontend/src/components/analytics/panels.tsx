import { useMemo, useState } from 'react'
import {
  CURRENT,
  RECORDS,
  SPARK,
  SUMMARY,
  SUMMARY_PREVIOUS,
  TOPIC_MATRIX,
  TOPICS,
  type EvalRecord,
  type Insight,
} from './data'
import {
  INK,
  SEQUENTIAL,
  SERIES,
  SERIES_ORDER,
  STATUS,
  inkOnSequential,
  sequentialStep,
} from './palette'
import { Sparkline } from './charts'
import { Modal } from '../ui/Modal'
import { InfoPopover } from '../ui/InfoPopover'

// ------------------------------------------------------------------- KPIs

interface Kpi {
  label: string
  value: string
  spark: { v: number }[]
  colour: string
  delta: number
  /** Whether an increase is good — a rise in latency is not. */
  higherIsBetter: boolean
  unit?: string
  note: string
  /** Plain-English explanation behind the ⓘ. Nobody should have to guess "p95". */
  info: string
}

function DeltaChip({ delta, higherIsBetter, unit = '' }: { delta: number; higherIsBetter: boolean; unit?: string }) {
  if (Math.abs(delta) < 0.05) {
    return <span className="tabular text-[13px] text-ink-faint">no change</span>
  }
  const improved = higherIsBetter ? delta > 0 : delta < 0
  return (
    <span
      className="tabular text-[13px] font-semibold"
      style={{ color: improved ? STATUS.good : STATUS.critical }}
    >
      {delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}
      {unit}
    </span>
  )
}

export function KpiStrip() {
  const kpis: Kpi[] = [
    {
      label: 'Answers evaluated',
      value: SUMMARY.count.toLocaleString(),
      spark: SPARK.volume,
      colour: SERIES.correctness,
      delta: SUMMARY.count - SUMMARY_PREVIOUS.count,
      higherIsBetter: true,
      note: 'last 7 days',
      info: 'How many answers the assistant produced and we scored in the last seven days. The comparison is against the seven days before that, so a rise means more usage rather than better quality.',
    },
    {
      label: 'Pass rate',
      value: `${SUMMARY.passRate.toFixed(1)}%`,
      spark: SPARK.passRate,
      colour: SERIES.faithfulness,
      delta: SUMMARY.passRate - SUMMARY_PREVIOUS.passRate,
      higherIsBetter: true,
      unit: 'pp',
      note: 'scored 70 or above',
      info: 'The share of answers that reached our pass mark of 70 out of 100. "pp" means percentage points — a move from 96% to 98% is +2pp, not +2%.',
    },
    {
      label: 'Average score',
      value: SUMMARY.avgScore.toFixed(1),
      spark: SPARK.score,
      colour: SERIES.correctness,
      delta: SUMMARY.avgScore - SUMMARY_PREVIOUS.avgScore,
      higherIsBetter: true,
      note: 'out of 100',
      info: 'The mean combined score across every answer: rule checks 30%, the AI judge 40%, human review 30%. Useful as a headline, but an average hides shape — the distribution chart below shows whether 90 means "mostly 90".',
    },
    {
      label: 'Hallucination rate',
      value: `${SUMMARY.hallucinationRate.toFixed(1)}%`,
      spark: SPARK.faithfulness,
      colour: SERIES.completeness,
      delta: SUMMARY.hallucinationRate - SUMMARY_PREVIOUS.hallucinationRate,
      higherIsBetter: false,
      unit: 'pp',
      note: 'faithfulness under 0.70',
      info: 'The share of answers that made a claim the retrieved documents did not support — in other words, the assistant made something up. Measured as faithfulness scoring below 0.70. This is the number to watch most closely: a made-up IT policy sends staff down the wrong path.',
    },
    {
      label: 'p95 latency',
      value: `${(SUMMARY.p95 / 1000).toFixed(2)}s`,
      spark: SPARK.p95,
      colour: SERIES.relevancy,
      delta: (SUMMARY.p95 - SUMMARY_PREVIOUS.p95) / 1000,
      higherIsBetter: false,
      unit: 's',
      note: '19 in 20 are faster',
      info: 'p95 means the 95th percentile: 95 out of every 100 answers came back faster than this, and 5 were slower. We show it instead of the average because an average is dragged down by the fast majority and hides the slow tail — and the slow answers are the ones users actually notice and complain about.',
    },
    {
      label: 'Spend',
      value: `$${SUMMARY.cost.toFixed(2)}`,
      spark: SPARK.cost,
      colour: SERIES.correctness,
      delta: SUMMARY.cost - SUMMARY_PREVIOUS.cost,
      higherIsBetter: false,
      note: 'judge + assistant',
      info: 'Estimated spend on model calls over the period, covering both the assistant writing answers and the judge scoring them. The judge is usually the larger share, because it makes several calls per answer.',
    },
    {
      label: 'Security blocks',
      value: String(SUMMARY.blocked),
      spark: SPARK.passRate,
      colour: STATUS.critical,
      delta: SUMMARY.blocked - SUMMARY_PREVIOUS.blocked,
      higherIsBetter: false,
      note: 'released regardless is never an option',
      info: 'Answers stopped by a failed security check — a leaked credential, exposed personal data, or obeying an instruction hidden in a user question. These are blocked outright regardless of how well they scored elsewhere, because a good answer does not cancel out a data leak.',
    },
    {
      label: 'Judge–human agreement',
      value: `${SUMMARY.humanAgreement.toFixed(0)}%`,
      spark: SPARK.score,
      colour: SERIES.faithfulness,
      delta: SUMMARY.humanAgreement - SUMMARY_PREVIOUS.humanAgreement,
      higherIsBetter: true,
      unit: 'pp',
      note: `${SUMMARY.reviewed} answers reviewed`,
      info: 'How often the AI judge and a human reviewer put an answer on the same side of the pass mark. This is the number that justifies trusting the automated scores between human reviews. If it dropped below about 80%, the judge would need recalibrating before anyone relied on it.',
    },
  ]

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {kpis.map((kpi) => (
        <div key={kpi.label} className="rounded-lg border border-line bg-surface p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="text-[13px] font-medium uppercase tracking-wider text-ink-muted">
              {kpi.label}
            </p>
            <InfoPopover title={kpi.label}>{kpi.info}</InfoPopover>
          </div>
          <div className="mt-1 flex items-baseline justify-between gap-2">
            <p className="tabular text-[26px] font-semibold text-ink">{kpi.value}</p>
            <DeltaChip delta={kpi.delta} higherIsBetter={kpi.higherIsBetter} unit={kpi.unit} />
          </div>
          <div className="mt-1.5">
            <Sparkline data={kpi.spark} colour={kpi.colour} />
          </div>
          <p className="mt-1 text-[12px] text-ink-faint">{kpi.note}</p>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------- heatmap

/**
 * Topic × metric. Sequential encoding — one hue, light to dark — because the
 * value is a magnitude. Every cell carries its number, which is also the
 * documented relief for the two hues that sit under 3:1 on white.
 */
export function TopicHeatmap() {
  const columns = SERIES_ORDER

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate border-spacing-[2px]">
          <thead>
            <tr>
              <th scope="col" className="w-40 px-2 py-1 text-left text-[12px] uppercase tracking-wider text-ink-muted">
                Topic
              </th>
              {columns.map((column) => (
                <th
                  key={column}
                  scope="col"
                  className="px-2 py-1 text-center text-[12px] uppercase tracking-wider text-ink-muted"
                >
                  {column}
                </th>
              ))}
              <th scope="col" className="w-20 px-2 py-1 text-right text-[12px] uppercase tracking-wider text-ink-muted">
                Answers
              </th>
            </tr>
          </thead>
          <tbody>
            {TOPIC_MATRIX.map((row) => (
              <tr key={row.topic}>
                <th scope="row" className="px-2 py-1 text-left text-[14px] font-medium text-ink">
                  {row.topic}
                </th>
                {columns.map((column) => {
                  const value = row[column]
                  return (
                    <td
                      key={column}
                      title={`${row.topic} · ${column}: ${value.toFixed(1)}`}
                      className="tabular rounded px-2 py-2.5 text-center text-[14px] font-semibold"
                      style={{
                        background: sequentialStep(value),
                        color: inkOnSequential(value),
                      }}
                    >
                      {value.toFixed(1)}
                    </td>
                  )
                })}
                <td className="tabular px-2 py-2 text-right text-[13px] text-ink-muted">
                  {row.volume}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-ink-muted">Weaker</span>
        {SEQUENTIAL.map((step) => (
          <span
            key={step}
            className="inline-block h-3 w-8 rounded-sm"
            style={{ background: step }}
          />
        ))}
        <span className="text-[13px] text-ink-muted">Stronger</span>
        <span className="tabular ml-2 text-[13px] text-ink-faint">scale 60 – 100</span>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- insights

export function Insights({ insights }: { insights: Insight[] }) {
  const tone = {
    critical: { border: 'border-bad/40', bg: 'bg-bad-soft', text: STATUS.critical, label: 'Needs attention' },
    warning: { border: 'border-warn/40', bg: 'bg-warn-soft', text: STATUS.serious, label: 'Worth watching' },
    good: { border: 'border-ok/40', bg: 'bg-ok-soft', text: STATUS.good, label: 'Healthy' },
  }

  return (
    <ol className="space-y-2">
      {insights.map((insight) => {
        const style = tone[insight.tone]
        return (
          <li key={insight.headline} className={`rounded-lg border p-3 ${style.border} ${style.bg}`}>
            <p className="text-[12px] font-semibold uppercase tracking-wider" style={{ color: style.text }}>
              {style.label}
            </p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{insight.headline}</p>
            <p className="mt-1 max-w-[80ch] text-[14px] leading-relaxed text-ink-muted">
              {insight.detail}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

// ------------------------------------------------------- evaluations table

const VERDICT_STYLE: Record<string, { bg: string; label: string }> = {
  pass: { bg: STATUS.good, label: 'PASS' },
  fail: { bg: STATUS.serious, label: 'FAIL' },
  blocked: { bg: STATUS.critical, label: 'BLOCKED' },
}

export function EvaluationsTable({
  filterCheck,
  onClearFilter,
}: {
  filterCheck: string | null
  onClearFilter: () => void
}) {
  const [topic, setTopic] = useState<string>('All')
  const [verdict, setVerdict] = useState<string>('All')
  const [selected, setSelected] = useState<EvalRecord | null>(null)

  const rows = useMemo(() => {
    return CURRENT.filter((record) => {
      if (topic !== 'All' && record.topic !== topic) return false
      if (verdict !== 'All' && record.verdict !== verdict) return false
      if (filterCheck && !record.ruleFailures.some((f) => f.name === filterCheck)) return false
      return true
    })
      .slice()
      .sort((a, b) => a.finalScore - b.finalScore)
      .slice(0, 40)
  }, [topic, verdict, filterCheck])

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          className="min-h-9 rounded-md border border-line bg-surface px-2 text-[14px] text-ink"
        >
          <option value="All">All topics</option>
          {TOPICS.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>

        <select
          value={verdict}
          onChange={(event) => setVerdict(event.target.value)}
          className="min-h-9 rounded-md border border-line bg-surface px-2 text-[14px] text-ink"
        >
          <option value="All">All verdicts</option>
          <option value="pass">Passed</option>
          <option value="fail">Failed</option>
          <option value="blocked">Blocked</option>
        </select>

        {filterCheck && (
          <button
            type="button"
            onClick={onClearFilter}
            className="min-h-9 cursor-pointer rounded-md border border-brand bg-brand-soft px-2.5 text-[13px] font-medium text-brand"
          >
            failed “{filterCheck.replace(/_/g, ' ')}” ✕
          </button>
        )}

        <p className="tabular ml-auto text-[13px] text-ink-faint">
          worst {rows.length} of {CURRENT.length}
        </p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-line">
        <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
          <thead>
            <tr className="border-b border-line bg-raised text-[12px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-3 py-2 font-medium">Question</th>
              <th scope="col" className="px-3 py-2 font-medium">Topic</th>
              <th scope="col" className="px-3 py-2 font-medium">Ver</th>
              <th scope="col" className="px-3 py-2 font-medium">Score</th>
              <th scope="col" className="px-3 py-2 font-medium">Rules</th>
              <th scope="col" className="px-3 py-2 font-medium">Latency</th>
              <th scope="col" className="px-3 py-2 font-medium">Verdict</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((record) => (
              <tr
                key={record.id}
                onClick={() => setSelected(record)}
                className="cursor-pointer border-t border-line transition-colors duration-200 hover:bg-raised"
              >
                <td className="max-w-72 truncate px-3 py-2 text-ink" title={record.question}>
                  {record.question}
                </td>
                <td className="px-3 py-2 text-ink-muted">{record.topic}</td>
                <td className="tabular px-3 py-2 text-ink-muted">{record.version}</td>
                <td className="tabular px-3 py-2 font-semibold text-ink">
                  {record.finalScore.toFixed(0)}
                </td>
                <td className="tabular px-3 py-2 text-ink-muted">
                  {record.ruleChecksPassed}/{record.ruleChecksTotal}
                </td>
                <td className="tabular px-3 py-2 text-ink-muted">{record.latencyMs} ms</td>
                <td className="px-3 py-2">
                  <span
                    className="rounded px-1.5 py-0.5 text-[12px] font-semibold text-white"
                    style={{ background: VERDICT_STYLE[record.verdict].bg }}
                  >
                    {VERDICT_STYLE[record.verdict].label}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-ink-muted">
                  Nothing matches those filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[13px] text-ink-faint">
        Sorted worst first. Click any row to see the full trace for that answer.
      </p>

      <TraceModal record={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

// ---------------------------------------------------------- trace waterfall

/** A single request broken into its steps, the way a tracing tool shows it. */
function TraceModal({ record, onClose }: { record: EvalRecord | null; onClose: () => void }) {
  if (!record) return null

  const steps = [
    { name: 'Retrieve from knowledge base', ms: Math.round(record.latencyMs * 0.04), colour: SERIES.faithfulness },
    { name: 'Assemble prompt', ms: Math.round(record.latencyMs * 0.02), colour: SERIES.relevancy },
    { name: 'Generate answer (LLM)', ms: Math.round(record.latencyMs * 0.82), colour: SERIES.correctness },
    { name: 'Run 17 rule checks', ms: Math.round(record.latencyMs * 0.01), colour: SERIES.completeness },
    { name: 'Judge — 4 metrics', ms: Math.round(record.latencyMs * 0.11), colour: SERIES.completeness },
  ]
  const total = steps.reduce((sum, step) => sum + step.ms, 0)
  let elapsed = 0

  return (
    <Modal
      open={record !== null}
      onClose={onClose}
      title={`Trace — ${record.id}`}
      subtitle={record.question}
      width="lg"
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-1.5 text-[13px]">
          {[
            `${record.topic}`,
            `${record.version}`,
            `${record.latencyMs} ms`,
            `${record.promptTokens + record.completionTokens} tokens`,
            `$${record.costUsd.toFixed(4)}`,
          ].map((chip) => (
            <span key={chip} className="tabular rounded bg-raised px-2 py-1 text-ink-muted ring-1 ring-line">
              {chip}
            </span>
          ))}
          <span
            className="rounded px-2 py-1 text-[12px] font-semibold text-white"
            style={{ background: VERDICT_STYLE[record.verdict].bg }}
          >
            {VERDICT_STYLE[record.verdict].label}
          </span>
        </div>

        <section>
          <h3 className="mb-2 text-[14px] font-semibold text-ink">Where the time went</h3>
          <ul className="space-y-1.5">
            {steps.map((step) => {
              const offset = (elapsed / total) * 100
              const width = (step.ms / total) * 100
              elapsed += step.ms
              return (
                <li key={step.name} className="flex items-center gap-3">
                  <span className="w-52 shrink-0 text-[13px] text-ink">{step.name}</span>
                  <span className="relative h-5 flex-1 rounded bg-raised">
                    <span
                      className="absolute inset-y-0 rounded"
                      style={{
                        left: `${offset}%`,
                        width: `${Math.max(width, 1)}%`,
                        background: step.colour,
                      }}
                    />
                  </span>
                  <span className="tabular w-16 shrink-0 text-right text-[13px] text-ink-muted">
                    {step.ms} ms
                  </span>
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-semibold text-ink">Judge scores</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {SERIES_ORDER.map((key) => {
              const value = record.scores[key] * 100
              return (
                <div key={key} className="rounded-md border border-line p-2.5">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[14px] capitalize text-ink">{key}</span>
                    <span
                      className="tabular text-[15px] font-semibold"
                      style={{ color: value >= 70 ? STATUS.good : STATUS.critical }}
                    >
                      {value.toFixed(1)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 rounded-full bg-raised">
                    <div
                      className="h-1.5 rounded-full"
                      style={{ width: `${value}%`, background: SERIES[key] }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[14px] font-semibold text-ink">
            Rule checks — {record.ruleChecksPassed} of {record.ruleChecksTotal} passed
          </h3>
          {record.ruleFailures.length === 0 ? (
            <p className="rounded-md border p-2.5 text-[14px]" style={{ borderColor: STATUS.good, color: STATUS.good }}>
              Every check passed.
            </p>
          ) : (
            <ul className="space-y-1">
              {record.ruleFailures.map((failure) => (
                <li
                  key={failure.name}
                  className="tabular rounded-md border border-line px-2.5 py-2 text-[13px] text-ink"
                >
                  <span
                    className="mr-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-semibold text-white"
                    style={{
                      background: failure.group === 'security' ? STATUS.critical : STATUS.serious,
                    }}
                  >
                    {failure.group}
                  </span>
                  {failure.name.replace(/_/g, ' ')}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h3 className="mb-1.5 text-[14px] font-semibold text-ink">Answer</h3>
          <p className="rounded-md border border-line bg-canvas p-3 text-[14px] leading-relaxed text-ink">
            {record.answer}
          </p>
          <p className="tabular mt-1.5 text-[13px] text-ink-faint">
            retrieved {record.retrievedIds.join(', ')}
          </p>
        </section>
      </div>
    </Modal>
  )
}

/** Small helper so the tab can show how many records back the page. */
export const TOTAL_RECORDS = RECORDS.length
export const INK_TOKENS = INK
