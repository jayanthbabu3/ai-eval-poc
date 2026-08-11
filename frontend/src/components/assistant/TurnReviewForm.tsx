import { useEffect, useState } from 'react'
import type { HumanRubric, RubricItem, Turn } from '../../lib/types'
import { api } from '../../lib/api'
import { Banner, Button } from '../Primitives'
import { SpinnerIcon } from '../Icons'

type Scores = { correctness: number; completeness: number; clarity: number; tone: number }

const DEFAULT_SCORES: Scores = { correctness: 3, completeness: 3, clarity: 3, tone: 3 }

function ScaleRow({
  item,
  max,
  value,
  onChange,
  turnId,
}: {
  item: RubricItem
  max: number
  value: number
  onChange: (next: number) => void
  turnId: string
}) {
  return (
    <fieldset>
      <legend className="text-[14px] font-medium text-ink">{item.label}</legend>
      <p className="mb-1.5 text-[13px] text-ink-faint">{item.question}</p>
      <div className="flex gap-1.5">
        {Array.from({ length: max }, (_, index) => index + 1).map((option) => (
          <label
            key={option}
            title={item.guidance}
            className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center rounded-md text-[15px] font-medium ring-1 transition-colors duration-200 ${
              value === option
                ? 'bg-brand text-white ring-brand'
                : 'bg-raised text-ink-muted ring-line hover:text-ink'
            }`}
          >
            <input
              type="radio"
              name={`${item.id}-${turnId}`}
              value={option}
              checked={value === option}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            {option}
          </label>
        ))}
      </div>
    </fieldset>
  )
}

export function TurnReviewForm({
  turn,
  onSaved,
}: {
  turn: Turn
  onSaved: (turn: Turn) => void
}) {
  const [rubric, setRubric] = useState<HumanRubric | null>(null)
  const [reviewer, setReviewer] = useState('')
  const [scores, setScores] = useState<Scores>(DEFAULT_SCORES)
  const [shipIt, setShipIt] = useState(true)
  const [comment, setComment] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    api
      .humanRubric()
      .then((result) => active && setRubric(result))
      .catch(() => active && setError('Could not load the review rubric.'))
    return () => {
      active = false
    }
  }, [])

  // Reset to whatever is already saved whenever a different turn is opened.
  useEffect(() => {
    setScores({
      correctness: turn.human?.correctness ?? 3,
      completeness: turn.human?.completeness ?? 3,
      clarity: turn.human?.clarity ?? 3,
      tone: turn.human?.tone ?? 3,
    })
    setShipIt(turn.human?.ship_it ?? true)
    setComment(turn.human?.comment ?? '')
    setReviewer(turn.human?.reviewer ?? '')
    setError(null)
  }, [turn.id, turn.human])

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      const updated = await api.reviewTurn(turn.id, {
        reviewer: reviewer.trim() || 'anonymous',
        ...scores,
        ship_it: shipIt,
        comment,
      })
      onSaved(updated)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the review.')
    } finally {
      setSaving(false)
    }
  }

  const scaleItems = rubric?.items.filter((item) => item.kind === 'scale') ?? []
  const shipItem = rubric?.items.find((item) => item.kind === 'boolean')

  return (
    <form
      className="space-y-3"
      onSubmit={(event) => {
        event.preventDefault()
        void submit()
      }}
    >
      <p className="text-[13px] text-ink-faint">
        The judge is itself a model. A human score is what catches the cases where the rules
        and the judge both get it wrong.
      </p>

      <label className="block">
        <span className="text-[14px] font-medium text-ink">Reviewer</span>
        <input
          value={reviewer}
          onChange={(event) => setReviewer(event.target.value)}
          placeholder="your name"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-2.5 py-2 text-[15px] text-ink placeholder:text-ink-faint"
        />
      </label>

      {!rubric && <p className="text-[14px] text-ink-muted">Loading rubric…</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        {scaleItems.map((item) => (
          <ScaleRow
            key={item.id}
            item={item}
            max={rubric?.scale_max ?? 5}
            turnId={turn.id}
            value={scores[item.id as keyof Scores] ?? 3}
            onChange={(next) => setScores((current) => ({ ...current, [item.id]: next }))}
          />
        ))}
      </div>

      {shipItem && (
        <fieldset className="rounded-md border border-line bg-canvas p-2.5">
          <legend className="px-1 text-[14px] font-medium text-ink">{shipItem.label}</legend>
          <p className="mb-1.5 text-[13px] text-ink-faint">{shipItem.question}</p>
          <div className="flex gap-1.5">
            {[
              { value: true, label: 'Yes, send it' },
              { value: false, label: 'No, not as-is' },
            ].map((option) => (
              <label
                key={String(option.value)}
                className={`flex min-h-11 cursor-pointer items-center rounded-md px-3 text-[15px] font-medium ring-1 transition-colors duration-200 ${
                  shipIt === option.value
                    ? option.value
                      ? 'bg-ok/15 text-ok ring-ok/40'
                      : 'bg-bad/15 text-bad ring-bad/40'
                    : 'bg-raised text-ink-muted ring-line hover:text-ink'
                }`}
              >
                <input
                  type="radio"
                  name={`ship-${turn.id}`}
                  checked={shipIt === option.value}
                  onChange={() => setShipIt(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
          <p className="mt-1.5 text-[13px] text-ink-faint">
            Recorded and shown, but not averaged into the score.
          </p>
        </fieldset>
      )}

      <label className="block">
        <span className="text-[14px] font-medium text-ink">Comment</span>
        <textarea
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          rows={2}
          placeholder="What would you change about this answer?"
          className="mt-1 w-full rounded-md border border-line bg-canvas px-2.5 py-2 text-[15px] text-ink placeholder:text-ink-faint"
        />
      </label>

      {error && <Banner tone="error">{error}</Banner>}

      <Button type="submit" disabled={saving || !rubric}>
        {saving && <SpinnerIcon />}
        {saving ? 'Saving' : turn.human ? 'Update score' : 'Save score'}
      </Button>
    </form>
  )
}
