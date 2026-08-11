import {
  Bar,
  BarChart,
  Cell,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { RuleGroup, Turn, TurnScore } from '../../lib/types'

const AXIS = { fill: '#6b7c95', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }
const GRID = '#d3e0ee'
const PASS_SCORE = 70

const COLOUR = {
  pass: '#047857',
  fail: '#c2273f',
  blocked: '#7f1d2b',
  pending: '#b3c7dc',
  brand: '#1d4ed8',
}

const tooltipStyle = {
  contentStyle: {
    background: '#ffffff',
    border: '1px solid #b3c7dc',
    borderRadius: 6,
    fontSize: 13,
    boxShadow: '0 4px 12px rgba(22,35,58,0.08)',
  },
  labelStyle: { color: '#16233a' },
  cursor: { fill: 'rgba(29,78,216,0.06)' },
}

const LABEL_MAX = 38

/**
 * Axis labels are the question itself, shortened — not the internal case ID.
 * "TC-002" tells a reader nothing; "What are the password rules…" tells them
 * everything they need to place the bar.
 *
 * Labels must also be unique, or Recharts silently stacks bars onto one tick,
 * which is why the same question asked twice gets a #2 suffix.
 */
function shorten(question: string): string {
  const clean = question.trim()
  if (clean.length <= LABEL_MAX) return clean
  const cut = clean.slice(0, LABEL_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 20 ? lastSpace : LABEL_MAX)}…`
}

function uniqueLabels(rows: { id: string; question: string }[]): Map<string, string> {
  const seen = new Map<string, number>()
  const labels = new Map<string, string>()
  for (const row of rows) {
    const base = shorten(row.question)
    const count = (seen.get(base) ?? 0) + 1
    seen.set(base, count)
    labels.set(row.id, count === 1 ? base : `${base} (${count})`)
  }
  return labels
}

/** How far through the evaluation you are, per method. */
export function CoverageStrip({
  turns,
  total,
}: {
  turns: Turn[]
  total: number
}) {
  const counts = [
    {
      key: 'rules',
      label: 'Rule checks',
      done: turns.filter((turn) => turn.rules !== null).length,
      hint: 'Instant and free — run these on everything.',
    },
    {
      key: 'judge',
      label: 'LLM judge',
      done: turns.filter(
        (turn) => turn.judge !== null && turn.judge.scores.some((s) => !s.error),
      ).length,
      hint: 'Costs a model call per metric.',
    },
    {
      key: 'human',
      label: 'Human review',
      done: turns.filter((turn) => turn.human !== null).length,
      hint: 'Slow, so usually done on a sample.',
    },
  ]

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {counts.map((entry) => {
        const fraction = total === 0 ? 0 : entry.done / total
        return (
          <div key={entry.key} className="rounded-lg border border-line bg-surface p-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[14px] font-medium text-ink">{entry.label}</p>
              <p className="tabular text-[14px] text-ink">
                {entry.done}
                <span className="text-ink-faint"> / {total}</span>
              </p>
            </div>
            <div className="mt-2 h-1.5 rounded-full bg-raised">
              <div
                className={`h-1.5 rounded-full ${
                  fraction === 1 ? 'bg-ok' : fraction === 0 ? 'bg-line-strong' : 'bg-brand'
                }`}
                style={{ width: `${fraction * 100}%` }}
              />
            </div>
            <p className="mt-1.5 text-[13px] text-ink-faint">
              {entry.done === 0 ? `Not run yet. ${entry.hint}` : entry.hint}
            </p>
          </div>
        )
      })}
    </div>
  )
}

/** Final score per question, sorted worst-first — the weakest answers surface. */
export function ScoreByQuestion({
  scores,
  turns,
}: {
  scores: { id: string; question: string; score: TurnScore }[]
  turns: Turn[]
}) {
  const labels = uniqueLabels(scores.map((entry) => ({ id: entry.id, question: entry.question })))

  const data = scores
    .filter((entry) => entry.score.final !== null)
    .map((entry) => ({
      label: labels.get(entry.id) ?? entry.id,
      question: entry.question,
      caseId: turns.find((turn) => turn.id === entry.id)?.case_id ?? 'typed by hand',
      score: entry.score.final as number,
      verdict: entry.score.verdict,
    }))
    .sort((a, b) => a.score - b.score)

  if (data.length === 0) {
    return <p className="text-[14px] text-ink-muted">Nothing evaluated yet.</p>
  }

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
        <CartesianGrid stroke={GRID} horizontal={false} />
        <XAxis type="number" domain={[0, 100]} tick={AXIS} stroke={GRID} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ ...AXIS, fontFamily: 'Inter, sans-serif', fontSize: 13 }}
          stroke={GRID}
          width={280}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(value) => [`${Number(value).toFixed(0)} / 100`, 'Final score']}
          labelFormatter={(label, payload) => {
            const row = payload?.[0]?.payload as { question?: string; caseId?: string }
            return row?.question ? `${row.question} (${row.caseId})` : String(label)
          }}
        />
        <ReferenceLine
          x={PASS_SCORE}
          stroke="#b45309"
          strokeDasharray="4 3"
          label={{ value: 'pass 70', fill: '#b45309', fontSize: 12, position: 'top' }}
        />
        <Bar dataKey="score" name="Final score" radius={[0, 4, 4, 0]} isAnimationActive={false}>
          {data.map((entry) => (
            <Cell
              key={entry.label}
              fill={COLOUR[entry.verdict as keyof typeof COLOUR] ?? COLOUR.pending}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface FailureHit {
  question: string
  caseId: string
  detail: string
}

export interface Failure {
  key: string
  name: string
  group: RuleGroup
  explanation: string
  hits: FailureHit[]
}

/** Collects every rule failure, grouped by which check raised it. */
export function collectFailures(turns: Turn[]): Failure[] {
  const failures = new Map<string, Failure>()
  for (const turn of turns) {
    for (const check of turn.rules?.checks ?? []) {
      if (check.status !== 'fail') continue
      const entry = failures.get(check.name) ?? {
        key: check.name,
        name: check.name.replace(/_/g, ' '),
        group: check.group,
        explanation: check.explanation,
        hits: [],
      }
      failures.set(check.name, {
        ...entry,
        hits: [
          ...entry.hits,
          {
            question: turn.question,
            caseId: turn.case_id ?? 'typed by hand',
            detail: check.detail,
          },
        ],
      })
    }
  }
  return [...failures.values()].sort((a, b) => b.hits.length - a.hits.length)
}

const GROUP_COLOUR: Record<RuleGroup, string> = {
  security: '#7f1d2b',
  grounding: '#1d4ed8',
  format: '#b45309',
  performance: '#0f766e',
}

const GROUP_NAME: Record<RuleGroup, string> = {
  security: 'Security',
  grounding: 'Grounding',
  format: 'Format',
  performance: 'Performance',
}

/**
 * Which checks fail, and how often.
 *
 * Drawn as real <button> elements rather than an SVG chart: the bars must be
 * clickable and keyboard-reachable, and Recharts' click payloads proved
 * unreliable across versions. This also makes each bar focusable, which an SVG
 * rect never is.
 */
export function FailuresByCheck({
  turns,
  onSelect,
}: {
  turns: Turn[]
  onSelect: (failure: Failure) => void
}) {
  const data = collectFailures(turns)

  if (data.length === 0) {
    return (
      <p className="rounded-md border border-ok/30 bg-ok-soft p-3 text-[14px] text-ok">
        No rule check has failed on any question. Every answer passed all 17 gates.
      </p>
    )
  }

  const worst = Math.max(...data.map((failure) => failure.hits.length))
  const groupsPresent = [...new Set(data.map((failure) => failure.group))]

  return (
    <>
      <p className="mb-3 text-[14px] text-ink-muted">
        Click any bar to see which questions failed it and why.
      </p>

      <ul className="space-y-2">
        {data.map((failure) => {
          const width = (failure.hits.length / worst) * 100
          return (
            <li key={failure.key}>
              <button
                type="button"
                onClick={() => onSelect(failure)}
                className="group flex w-full cursor-pointer items-center gap-3 rounded-md border border-line px-3 py-2 text-left transition-colors duration-200 hover:border-brand hover:bg-brand-soft"
              >
                <span className="tabular w-40 shrink-0 text-[14px] font-medium text-ink">
                  {failure.name}
                </span>

                <span className="relative h-7 flex-1 overflow-hidden rounded bg-raised">
                  <span
                    className="absolute inset-y-0 left-0 rounded"
                    style={{
                      width: `${width}%`,
                      background: GROUP_COLOUR[failure.group],
                    }}
                  />
                  <span className="absolute inset-y-0 left-2 flex items-center text-[13px] font-semibold text-white">
                    {failure.hits.length}
                  </span>
                </span>

                <span className="w-44 shrink-0 text-right text-[13px] text-ink-muted">
                  of {turns.length} questions
                  {failure.group === 'security' && (
                    <span className="block text-[12px] font-semibold text-bad">
                      blocks release
                    </span>
                  )}
                </span>

                <span className="shrink-0 text-[13px] text-ink-faint group-hover:text-brand">
                  details →
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap gap-3">
        {groupsPresent.map((group) => (
          <span key={group} className="flex items-center gap-1.5 text-[13px] text-ink-muted">
            <span
              className="inline-block h-2.5 w-2.5 rounded-sm"
              style={{ background: GROUP_COLOUR[group] }}
            />
            {GROUP_NAME[group]}
          </span>
        ))}
      </div>
    </>
  )
}
