import type { Turn } from '../../lib/types'
import { Modal } from '../ui/Modal'
import type { Failure } from './ReportCharts'

const GROUP_LABEL: Record<string, string> = {
  security: 'Security',
  grounding: 'Grounding',
  format: 'Format & content',
  performance: 'Performance',
}

/**
 * The detail behind one bar: which questions failed this check, why, and what
 * the assistant actually said. A count on a chart is a prompt to investigate;
 * this is the investigation.
 */
export function FailureDetailModal({
  open,
  onClose,
  failure,
  turns,
}: {
  open: boolean
  onClose: () => void
  failure: Failure | null
  turns: Turn[]
}) {
  if (!failure) return null
  const isSecurity = failure.group === 'security'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={failure.name}
      subtitle={failure.explanation}
      width="lg"
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded bg-raised px-2 py-1 text-[13px] text-ink-muted ring-1 ring-line">
            {GROUP_LABEL[failure.group] ?? failure.group}
          </span>
          <span className="tabular rounded bg-raised px-2 py-1 text-[13px] text-ink-muted ring-1 ring-line">
            failed on {failure.hits.length} of {turns.length} questions
          </span>
          {isSecurity && (
            <span className="rounded bg-bad px-2 py-1 text-[13px] font-semibold text-white">
              Blocks release regardless of score
            </span>
          )}
        </div>

        <ol className="space-y-2">
          {failure.hits.map((hit, index) => {
            const turn = turns.find(
              (item) => item.question === hit.question && (item.case_id ?? 'typed by hand') === hit.caseId,
            )
            return (
              <li key={`${hit.caseId}-${index}`} className="rounded-lg border border-line p-3">
                <p className="text-[15px] font-medium text-ink">{hit.question}</p>
                <p className="tabular mt-0.5 text-[13px] text-ink-faint">{hit.caseId}</p>

                <p
                  className={`tabular mt-2 rounded-md border p-2.5 text-[13px] ${
                    isSecurity ? 'border-bad/30 bg-bad-soft text-bad' : 'border-warn/30 bg-warn-soft text-warn'
                  }`}
                >
                  Why it failed: {hit.detail}
                </p>

                {turn && (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-[13px] text-brand">
                      Show the answer that failed
                    </summary>
                    <p className="mt-1.5 whitespace-pre-wrap rounded-md border border-line bg-canvas p-2.5 text-[14px] leading-relaxed text-ink">
                      {turn.generation.answer || '(no answer returned)'}
                    </p>
                  </details>
                )}
              </li>
            )
          })}
        </ol>
      </div>
    </Modal>
  )
}
