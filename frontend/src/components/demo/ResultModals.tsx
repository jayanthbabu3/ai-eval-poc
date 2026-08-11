import type { Turn } from '../../lib/types'
import { Modal } from '../ui/Modal'
import { RuleChecklist } from '../assistant/RuleChecklist'
import { JudgePanel } from '../assistant/JudgePanel'
import { TurnReviewForm } from '../assistant/TurnReviewForm'

export function RuleResultModal({
  open,
  onClose,
  turn,
}: {
  open: boolean
  onClose: () => void
  turn: Turn | null
}) {
  if (!turn?.rules) return null
  const passed = turn.rules.checks.filter((check) => check.status === 'pass').length

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Rule checks — ${turn.case_id ?? turn.id}`}
      subtitle={`${passed} of ${turn.rules.checks.length} gates passed. No model was involved in any of these.`}
      width="lg"
    >
      <RuleChecklist checks={turn.rules.checks} animate={false} />
    </Modal>
  )
}

export function JudgeResultModal({
  open,
  onClose,
  turn,
  onViewPrompts,
}: {
  open: boolean
  onClose: () => void
  turn: Turn | null
  onViewPrompts: () => void
}) {
  if (!turn?.judge) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`LLM judge — ${turn.case_id ?? turn.id}`}
      subtitle="Each metric is scored by a second model, which explains its reasoning."
      width="lg"
    >
      <div className="space-y-3">
        <JudgePanel turn={turn} />
        {turn.judge.traces.length > 0 && (
          <button
            type="button"
            onClick={onViewPrompts}
            className="cursor-pointer text-[14px] text-brand underline decoration-dotted underline-offset-2"
          >
            See the {turn.judge.traces.length} verbatim prompts and replies →
          </button>
        )}
      </div>
    </Modal>
  )
}

export function HumanReviewModal({
  open,
  onClose,
  turn,
  onSaved,
  onViewRubric,
}: {
  open: boolean
  onClose: () => void
  turn: Turn | null
  onSaved: (turn: Turn) => void
  onViewRubric: () => void
}) {
  if (!turn) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Human review — ${turn.case_id ?? turn.id}`}
      subtitle="The manual step: a person scores the answer against a fixed rubric."
      width="lg"
    >
      <div className="space-y-3">
        <div className="rounded-md border border-line bg-canvas p-2.5">
          <p className="text-[14px] font-medium text-ink">The answer being reviewed</p>
          <p className="mt-1 whitespace-pre-wrap text-[13px] text-ink-muted">
            {turn.generation.answer}
          </p>
        </div>

        <button
          type="button"
          onClick={onViewRubric}
          className="cursor-pointer text-[14px] text-brand underline decoration-dotted underline-offset-2"
        >
          What exactly do we ask a reviewer? →
        </button>

        <TurnReviewForm
          turn={turn}
          onSaved={(updated) => {
            onSaved(updated)
            onClose()
          }}
        />
      </div>
    </Modal>
  )
}
