import type { AssistantVersion, CompareRow, TurnScore } from '../../lib/types'
import { Modal } from '../ui/Modal'
import { RuleChecklist } from '../assistant/RuleChecklist'
import { JudgePanel } from '../assistant/JudgePanel'

/**
 * Shows exactly how one question produced two scores.
 *
 * The comparison table can only show the final number, which leaves "why 89?"
 * unanswered. This opens the full working: both answers in full, every rule
 * check, every judge metric, and the arithmetic that combines them.
 */
function ScoreMaths({ score }: { score: TurnScore }) {
  const present = score.methods.filter((method) => method.score !== null)
  const weightTotal = present.reduce((sum, method) => sum + method.weight, 0)

  return (
    <div className="rounded-md border border-line bg-raised p-3">
      <p className="mb-2 text-[14px] font-semibold text-ink">How this score was calculated</p>
      <table className="w-full text-left text-[13px]">
        <thead>
          <tr className="text-[12px] uppercase tracking-wider text-ink-faint">
            <th scope="col" className="py-1 font-medium">Method</th>
            <th scope="col" className="py-1 font-medium">Score</th>
            <th scope="col" className="py-1 font-medium">Weight</th>
            <th scope="col" className="py-1 font-medium">Contributes</th>
          </tr>
        </thead>
        <tbody className="tabular">
          {score.methods.map((method) => {
            const share = method.score === null ? null : method.weight / weightTotal
            return (
              <tr key={method.key} className="border-t border-line">
                <td className="py-1.5 text-ink">{method.label}</td>
                <td className="py-1.5 text-ink">
                  {method.score === null ? (
                    <span className="text-ink-faint">not run</span>
                  ) : (
                    method.score.toFixed(1)
                  )}
                </td>
                <td className="py-1.5 text-ink-muted">
                  {method.score === null ? '—' : `${(share! * 100).toFixed(0)}%`}
                </td>
                <td className="py-1.5 text-ink">
                  {method.score === null ? '—' : (method.score * share!).toFixed(1)}
                </td>
              </tr>
            )
          })}
          <tr className="border-t-2 border-line-strong">
            <td className="py-1.5 font-semibold text-ink">Final</td>
            <td className="py-1.5 font-semibold text-ink" colSpan={3}>
              {score.final === null ? '—' : score.final.toFixed(1)} / 100
            </td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[13px] text-ink-muted">
        Human review does not run in a comparison, so its 30% is redistributed across the two
        methods that did run. That keeps both versions judged on identical terms.
      </p>
    </div>
  )
}

function VersionColumn({
  version,
  entry,
}: {
  version: AssistantVersion
  entry: { turn: CompareRow['versions'][string]['turn']; score: TurnScore }
}) {
  const { turn, score } = entry

  return (
    <div className="space-y-3">
      <header className="rounded-md border border-line bg-raised p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="font-display text-[16px] font-semibold text-ink">{version.label}</p>
          <p className="tabular text-[22px] font-bold text-ink">
            {score.final === null ? '—' : score.final.toFixed(0)}
            <span className="text-[14px] font-normal text-ink-faint"> / 100</span>
          </p>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          reads {version.top_k} article{version.top_k === 1 ? '' : 's'} · {version.model}
        </p>
      </header>

      <section>
        <h4 className="mb-1.5 text-[14px] font-semibold text-ink">The answer it gave</h4>
        <p className="whitespace-pre-wrap rounded-md border border-line p-3 text-[14px] leading-relaxed text-ink">
          {turn.generation.answer || '(no answer returned)'}
        </p>
      </section>

      <ScoreMaths score={score} />

      <section>
        <h4 className="mb-1.5 text-[14px] font-semibold text-ink">Rule checks</h4>
        {turn.rules ? (
          <RuleChecklist checks={turn.rules.checks} animate={false} />
        ) : (
          <p className="text-[14px] text-ink-muted">Not run.</p>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 text-[14px] font-semibold text-ink">LLM judge</h4>
        <JudgePanel turn={turn} />
      </section>
    </div>
  )
}

export function CompareDetailModal({
  open,
  onClose,
  row,
  versions,
}: {
  open: boolean
  onClose: () => void
  row: CompareRow | null
  versions: AssistantVersion[]
}) {
  if (!row) return null
  const [v1, v2] = versions

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${row.case_id} — how both versions scored`}
      subtitle={row.question}
      width="xl"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        {[v1, v2].map(
          (version) =>
            version &&
            row.versions[version.id] && (
              <VersionColumn
                key={version.id}
                version={version}
                entry={row.versions[version.id]}
              />
            ),
        )}
      </div>
    </Modal>
  )
}
