import { useEffect, useState } from 'react'
import type { Turn } from '../../lib/types'
import { ms } from '../../lib/format'
import { CheckIcon, SpinnerIcon } from '../Icons'

/**
 * Replays what the pipeline actually did, one stage at a time.
 *
 * The API returns the whole turn at once; the staging here is a replay so an
 * audience can follow it. Every number shown — scores, timings, sizes — is the
 * real measured value, never a simulated one.
 */
const STAGE_DELAY_MS = 420

export function PipelineTrace({ turn, animate }: { turn: Turn; animate: boolean }) {
  const [visible, setVisible] = useState(animate ? 0 : 4)

  useEffect(() => {
    if (!animate) {
      setVisible(4)
      return
    }
    setVisible(0)
    const timers = [1, 2, 3, 4].map((step) =>
      setTimeout(() => setVisible(step), STAGE_DELAY_MS * step),
    )
    return () => timers.forEach(clearTimeout)
  }, [turn.id, animate])

  const rejected = turn.retrieval.candidates.filter(
    (candidate) => !turn.retrieval.kept.some((kept) => kept.document_id === candidate.document_id),
  )

  return (
    <ol className="space-y-2">
      <Stage
        index={1}
        visible={visible >= 1}
        title="Searching the knowledge base"
        meta={`${ms(turn.retrieval.duration_ms)} · top ${turn.retrieval.top_k} of ${turn.retrieval.candidates.length} scored`}
      >
        <ul className="space-y-1">
          {turn.retrieval.kept.map((chunk) => (
            <li
              key={chunk.document_id}
              className="flex items-start justify-between gap-2 rounded border border-line bg-canvas px-2 py-1.5"
            >
              <span className="text-[13px] text-ink">
                <span className="tabular font-semibold text-brand">{chunk.document_id}</span>{' '}
                {chunk.title}
              </span>
              <span className="tabular shrink-0 text-[13px] text-ok">
                {chunk.score.toFixed(3)}
              </span>
            </li>
          ))}
          {turn.retrieval.kept.length === 0 && (
            <li className="rounded border border-accent/40 bg-accent/10 px-2 py-1.5 text-[13px] text-accent">
              Nothing scored above {turn.retrieval.min_score} — the assistant has no evidence and
              must say so.
            </li>
          )}
          {rejected.slice(0, 2).map((chunk) => (
            <li
              key={chunk.document_id}
              className="flex items-start justify-between gap-2 px-2 py-1 opacity-60"
            >
              <span className="text-[13px] text-ink-faint">
                <span className="tabular">{chunk.document_id}</span> {chunk.title} — not used
              </span>
              <span className="tabular shrink-0 text-[13px] text-ink-faint">
                {chunk.score.toFixed(3)}
              </span>
            </li>
          ))}
        </ul>
      </Stage>

      <Stage
        index={2}
        visible={visible >= 2}
        title="Building the grounded prompt"
        meta={`${turn.retrieval.kept.length} chunk(s) · ${turn.prompt_chars.toLocaleString()} chars of context`}
      >
        <p className="text-[13px] text-ink-muted">
          The model is instructed to answer only from this context, cite the article IDs, and
          never reveal credentials.
        </p>
      </Stage>

      <Stage
        index={3}
        visible={visible >= 3}
        title={`Calling ${turn.generation.model}`}
        meta={`${ms(turn.generation.latency_ms)}${
          turn.generation.completion_tokens
            ? ` · ${turn.generation.completion_tokens} completion tokens`
            : ''
        }`}
      >
        {turn.generation.error && (
          <p className="rounded border border-bad/40 bg-bad/10 px-2 py-1.5 text-[13px] text-bad">
            {turn.generation.error}
          </p>
        )}
      </Stage>

      <Stage index={4} visible={visible >= 4} title="Answer returned" meta="ready to evaluate">
        <p className="text-[13px] text-ink-muted">
          Nothing has been judged yet — that is the next step, and it is deliberately separate.
        </p>
      </Stage>
    </ol>
  )
}

function Stage({
  index,
  visible,
  title,
  meta,
  children,
}: {
  index: number
  visible: boolean
  title: string
  meta: string
  children?: React.ReactNode
}) {
  return (
    <li
      className={`rounded-md border p-2.5 transition-opacity duration-200 ${
        visible ? 'border-line bg-surface opacity-100' : 'border-line/60 bg-surface/40 opacity-40'
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${
            visible ? 'bg-ok/15 text-ok ring-1 ring-ok/30' : 'bg-raised text-ink-faint'
          }`}
        >
          {visible ? <CheckIcon className="h-3 w-3" /> : index}
        </span>
        <span className="text-[14px] font-medium text-ink">{title}</span>
        <span className="tabular ml-auto text-[13px] text-ink-faint">
          {visible ? meta : <SpinnerIcon className="h-3 w-3" />}
        </span>
      </div>
      {visible && children && <div className="mt-2 pl-7">{children}</div>}
    </li>
  )
}
