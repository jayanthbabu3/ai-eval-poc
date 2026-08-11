import type { Turn } from '../../lib/types'
import { score as fmtScore } from '../../lib/format'
import { Banner } from '../Primitives'

/**
 * All four judge metrics, always, in a fixed order.
 *
 * Earlier this rendered scored metrics in one list and unscorable ones in a
 * separate notice below, so a turn where only one could be scored looked like
 * the judge checks one thing. It always attempts the same four; what varies is
 * whether each could be scored, and why not.
 */
const METRICS: { key: string; label: string; question: string }[] = [
  {
    key: 'correctness',
    label: 'Correctness',
    question: 'Does it match the known-good answer, especially the numbers?',
  },
  {
    key: 'completeness',
    label: 'Completeness',
    question: 'Does it cover every point the known-good answer makes?',
  },
  {
    key: 'faithfulness',
    label: 'Faithfulness',
    question: 'Is every claim supported by the retrieved articles?',
  },
  {
    key: 'relevancy',
    label: 'Relevancy',
    question: 'Does it actually answer the question that was asked?',
  },
]

type Row =
  | { state: 'scored'; score: number; threshold: number; reason: string }
  | { state: 'failed-call'; error: string }
  | { state: 'no-reference' }
  | { state: 'not-run' }

export function JudgePanel({ turn }: { turn: Turn }) {
  const judge = turn.judge
  if (!judge) return null

  if (judge.skipped_reason) {
    return <Banner tone="warn">Judge skipped: {judge.skipped_reason}</Banner>
  }

  const rows = METRICS.map((metric) => {
    const entry = judge.scores.find((item) => item.metric === metric.key)

    let row: Row
    if (entry?.error) {
      row = { state: 'failed-call', error: entry.error }
    } else if (entry) {
      row = {
        state: 'scored',
        score: entry.score,
        threshold: entry.threshold,
        reason: entry.reason,
      }
    } else if (judge.unscorable[metric.key]) {
      row = { state: 'no-reference' }
    } else {
      row = { state: 'not-run' }
    }

    return { ...metric, row }
  })

  const scored = rows.filter((item) => item.row.state === 'scored')
  const passed = scored.filter(
    (item) => item.row.state === 'scored' && item.row.score >= item.row.threshold,
  ).length

  return (
    <div className="space-y-3">
      <p className="tabular text-[14px] text-ink-muted">
        {METRICS.length} metrics attempted · {scored.length} scored ({passed} passed) ·{' '}
        {METRICS.length - scored.length} not scored
      </p>

      <ol className="space-y-2">
        {rows.map(({ key, label, question, row }) => (
          <li key={key} className="rounded-md border border-line px-3 py-2.5">
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[15px] font-medium text-ink">{label}</span>
              {row.state === 'scored' ? (
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span
                    className={`tabular text-[17px] font-semibold ${
                      row.score >= row.threshold ? 'text-ok' : 'text-bad'
                    }`}
                  >
                    {fmtScore(row.score)}
                  </span>
                  <span className="tabular text-[13px] text-ink-faint">
                    needs {row.threshold.toFixed(2)}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${
                      row.score >= row.threshold ? 'bg-ok-soft text-ok' : 'bg-bad-soft text-bad'
                    }`}
                  >
                    {row.score >= row.threshold ? 'PASS' : 'FAIL'}
                  </span>
                </span>
              ) : (
                <span className="rounded bg-warn-soft px-1.5 py-0.5 text-[12px] font-semibold text-warn">
                  NOT SCORED
                </span>
              )}
            </div>

            <p className="mt-0.5 text-[13px] text-ink-faint">{question}</p>

            {row.state === 'scored' && (
              <>
                <div className="relative mt-2 h-1.5 rounded-full bg-raised">
                  <div
                    className={`h-1.5 rounded-full ${
                      row.score >= row.threshold ? 'bg-ok' : 'bg-bad'
                    }`}
                    style={{ width: `${Math.min(100, row.score * 100)}%` }}
                  />
                  <div
                    className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink"
                    style={{ left: `${Math.min(100, row.threshold * 100)}%` }}
                    title={`pass mark ${row.threshold}`}
                  />
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">{row.reason}</p>
              </>
            )}

            {row.state === 'no-reference' && (
              <p className="mt-1.5 text-[14px] text-ink-muted">
                This question has no known-good answer, so there is nothing to compare against.
                Ask one of the suggested questions to see this metric scored.
              </p>
            )}

            {row.state === 'failed-call' && (
              <>
                <p className="mt-1.5 text-[14px] text-ink-muted">
                  The judge could not be reached. Excluded from the score rather than counted as
                  zero — a failed call says nothing about the answer's quality.
                </p>
                <p className="tabular mt-1.5 rounded border border-line bg-canvas p-2 text-[12px] leading-relaxed text-ink-muted">
                  {row.error}
                </p>
              </>
            )}

            {row.state === 'not-run' && (
              <p className="mt-1.5 text-[14px] text-ink-muted">Not attempted on this run.</p>
            )}
          </li>
        ))}
      </ol>
    </div>
  )
}
