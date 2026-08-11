import type { Turn, Verdict } from '../../lib/types'
import { ms } from '../../lib/format'
import { InfoButton } from '../ui/Modal'
import { SpinnerIcon } from '../Icons'

export type Method = 'rules' | 'judge' | 'human' | 'all'

const VERDICT_STYLE: Record<Verdict, string> = {
  pass: 'bg-ok/15 text-ok ring-ok/30',
  fail: 'bg-bad/15 text-bad ring-bad/30',
  blocked: 'bg-bad/20 text-bad ring-bad/50',
  pending: 'bg-raised text-ink-faint ring-line',
}

const VERDICT_LABEL: Record<Verdict, string> = {
  pass: 'PASS',
  fail: 'FAIL',
  blocked: 'BLOCKED',
  pending: 'NOT RUN',
}

function methodScore(turn: Turn, key: 'rules' | 'judge' | 'human') {
  return turn.score.methods.find((method) => method.key === key)?.score ?? null
}

/** One evaluation cell: the score if it has run, otherwise a Run button. */
function MethodCell({
  turn,
  method,
  busy,
  onRun,
  onOpen,
}: {
  turn: Turn
  method: 'rules' | 'judge' | 'human'
  busy: boolean
  onRun: () => void
  onOpen: () => void
}) {
  const score = methodScore(turn, method)
  const hasRun = score !== null

  // Rules show their raw check tally, which reads better than a percentage.
  const label =
    method === 'rules' && turn.rules
      ? `${turn.rules.checks.filter((c) => c.status === 'pass').length}/${turn.rules.checks.length}`
      : hasRun
        ? score.toFixed(0)
        : '—'

  return (
    <td className="px-2 py-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          disabled={!hasRun}
          title={hasRun ? 'View details' : 'Not evaluated yet'}
          className={`tabular min-w-10 rounded px-1.5 py-1 text-[14px] font-semibold ${
            hasRun
              ? 'cursor-pointer text-ink underline decoration-dotted underline-offset-2 hover:text-brand'
              : 'cursor-default text-ink-faint'
          }`}
        >
          {label}
        </button>
        <button
          type="button"
          onClick={onRun}
          disabled={busy}
          className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded border border-brand/30 bg-brand-soft px-2 text-[13px] font-medium text-brand transition-colors duration-200 hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <SpinnerIcon className="h-3 w-3" /> : null}
          {hasRun ? 'Re-run' : 'Run'}
        </button>
      </div>
    </td>
  )
}

export function ResultsTable({
  turns,
  busyTurnId,
  busyMethod,
  onRun,
  onOpenTurn,
  onOpenMethod,
  onOpenMethodInfo,
}: {
  turns: Turn[]
  busyTurnId: string | null
  busyMethod: Method | null
  onRun: (turn: Turn, method: Method) => void
  onOpenTurn: (turn: Turn) => void
  onOpenMethod: (turn: Turn, method: 'rules' | 'judge' | 'human') => void
  onOpenMethodInfo: (method: 'rules' | 'judge' | 'human' | 'version') => void
}) {
  const isBusy = (turn: Turn, method: Method) =>
    busyTurnId === turn.id && (busyMethod === method || busyMethod === 'all')

  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[1100px] border-collapse text-left text-[15px]">
        <thead>
          <tr className="border-b border-line bg-raised text-[13px] uppercase tracking-wider text-ink-muted">
            <th scope="col" className="px-2 py-2 font-medium">#</th>
            <th scope="col" className="px-2 py-2 font-medium">Question</th>
            <th scope="col" className="px-2 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Ver <InfoButton onClick={() => onOpenMethodInfo('version')} label="About assistant versions" />
              </span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">Sources used</th>
            <th scope="col" className="px-2 py-2 font-medium">Answer</th>
            <th scope="col" className="px-2 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Rules <InfoButton onClick={() => onOpenMethodInfo('rules')} label="What the rule checks validate" />
              </span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Judge <InfoButton onClick={() => onOpenMethodInfo('judge')} label="What we ask the LLM judge" />
              </span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">
              <span className="inline-flex items-center gap-1">
                Human <InfoButton onClick={() => onOpenMethodInfo('human')} label="What we ask a human reviewer" />
              </span>
            </th>
            <th scope="col" className="px-2 py-2 font-medium">Final</th>
            <th scope="col" className="px-2 py-2 font-medium">All</th>
          </tr>
        </thead>
        <tbody>
          {turns.map((turn, index) => {
            const sources = turn.retrieval.kept
            return (
              <tr key={turn.id} className="border-t border-line align-top hover:bg-raised/50">
                <td className="tabular px-2 py-2 text-[14px] text-ink-faint">{index + 1}</td>

                <td className="max-w-56 px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onOpenTurn(turn)}
                    className="cursor-pointer text-left text-[14px] text-ink underline decoration-dotted underline-offset-2 hover:text-brand"
                  >
                    {turn.question}
                  </button>
                  <p className="tabular mt-0.5 text-[12px] text-ink-faint">
                    {turn.case_id ?? 'typed'} · {ms(turn.generation.latency_ms)}
                  </p>
                </td>

                <td className="px-2 py-2">
                  <span className="tabular rounded bg-raised px-1.5 py-0.5 text-[12px] font-medium text-ink-muted ring-1 ring-line">
                    {turn.assistant_version.toUpperCase()}
                  </span>
                </td>

                <td className="px-2 py-2">
                  {sources.length === 0 ? (
                    <span className="text-[13px] text-accent">none</span>
                  ) : (
                    <ul className="space-y-0.5">
                      {sources.map((chunk) => (
                        <li key={chunk.document_id} className="tabular text-[13px] text-ink-muted">
                          <span className="text-brand">{chunk.document_id}</span>{' '}
                          {chunk.score.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  )}
                </td>

                <td className="max-w-72 px-2 py-2">
                  <p className="line-clamp-3 text-[13px] text-ink">
                    {turn.generation.answer || '(no answer)'}
                  </p>
                </td>

                <MethodCell
                  turn={turn}
                  method="rules"
                  busy={isBusy(turn, 'rules')}
                  onRun={() => onRun(turn, 'rules')}
                  onOpen={() => onOpenMethod(turn, 'rules')}
                />
                <MethodCell
                  turn={turn}
                  method="judge"
                  busy={isBusy(turn, 'judge')}
                  onRun={() => onRun(turn, 'judge')}
                  onOpen={() => onOpenMethod(turn, 'judge')}
                />
                <MethodCell
                  turn={turn}
                  method="human"
                  busy={isBusy(turn, 'human')}
                  onRun={() => onOpenMethod(turn, 'human')}
                  onOpen={() => onOpenMethod(turn, 'human')}
                />

                <td className="px-2 py-2">
                  <div className="flex flex-col items-start gap-1">
                    <span className="tabular text-base font-semibold text-ink">
                      {turn.score.final === null ? '—' : turn.score.final.toFixed(0)}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ring-1 ${
                        VERDICT_STYLE[turn.score.verdict]
                      }`}
                    >
                      {VERDICT_LABEL[turn.score.verdict]}
                    </span>
                    {!turn.score.is_complete && turn.score.methods_run > 0 && (
                      <span className="text-[12px] text-ink-faint">
                        {turn.score.methods_run}/3 methods
                      </span>
                    )}
                  </div>
                </td>

                <td className="px-2 py-2">
                  <button
                    type="button"
                    onClick={() => onRun(turn, 'all')}
                    disabled={busyTurnId === turn.id}
                    className="inline-flex min-h-8 cursor-pointer items-center gap-1 rounded bg-brand px-2.5 text-[13px] font-medium text-white transition-colors duration-200 hover:bg-brand-strong disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyTurnId === turn.id && busyMethod === 'all' && (
                      <SpinnerIcon className="h-3 w-3" />
                    )}
                    Run all
                  </button>
                </td>
              </tr>
            )
          })}
          {turns.length === 0 && (
            <tr>
              <td colSpan={10} className="px-3 py-8 text-center text-[15px] text-ink-muted">
                Ask a question above and it appears here as a row.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
