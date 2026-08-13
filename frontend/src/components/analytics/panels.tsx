import { useMemo, useState } from 'react'
import { RECORDS, TOPICS, formatDate, type EvalRecord, type Insight } from './data'
import { useView } from './view'
import {
  INK,
  SEQUENTIAL,
  SERIES,
  SERIES_ORDER,
  STATUS,
  inkOnSequential,
  sequentialStep,
} from './palette'
import { Modal } from '../ui/Modal'

// ---------------------------------------------------------------- heatmap

/**
 * Topic × metric. Sequential encoding — one hue, light to dark — because the
 * value is a magnitude. Every cell carries its number, which is also the
 * documented relief for the two hues that sit under 3:1 on white.
 */
export function TopicHeatmap() {
  const { topicMatrix } = useView()
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
            {topicMatrix.map((row) => (
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

  // A grid rather than a stack: four full-width banners look like error messages,
  // four columns look like a briefing.
  return (
    <ol className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
      {insights.map((insight) => {
        const style = tone[insight.tone]
        return (
          <li
            key={insight.headline}
            className={`flex flex-col rounded-xl border p-3 ${style.border} ${style.bg}`}
          >
            <p
              className="text-[11px] font-semibold uppercase tracking-[0.12em]"
              style={{ color: style.text }}
            >
              {style.label}
            </p>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-ink">
              {insight.headline}
            </p>
            <p className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{insight.detail}</p>
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
  const view = useView()
  const [topic, setTopic] = useState<string>('All')
  const [verdict, setVerdict] = useState<string>('All')
  const [selected, setSelected] = useState<EvalRecord | null>(null)

  const rows = useMemo(() => {
    return view.rows.filter((record) => {
      if (topic !== 'All' && record.topic !== topic) return false
      if (verdict !== 'All' && record.verdict !== verdict) return false
      if (filterCheck && !record.ruleFailures.some((f) => f.name === filterCheck)) return false
      return true
    })
      .slice()
      .sort((a, b) => a.finalScore - b.finalScore)
      .slice(0, 40)
  }, [view.rows, topic, verdict, filterCheck])

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
          worst {rows.length} of {view.rows.length.toLocaleString()} in {view.label}
        </p>
      </div>

      {/* Bounded height with a sticky header: an unbounded 40-row table makes the
          tile three times taller than the one beside it and leaves a white void. */}
      <div className="max-h-[420px] overflow-auto rounded-lg border border-line">
        <table className="w-full min-w-[900px] border-collapse text-left text-[14px]">
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-line bg-raised text-[12px] uppercase tracking-wider text-ink-muted">
              <th scope="col" className="px-3 py-2 font-medium">Date</th>
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
                <td className="tabular whitespace-nowrap px-3 py-2 text-ink-muted">
                  {formatDate(record.day)}
                </td>
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
                <td colSpan={8} className="px-3 py-8 text-center text-ink-muted">
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
            formatDate(record.day),
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
