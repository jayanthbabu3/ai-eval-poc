import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { SuiteScore, Turn, TurnScore } from '../../lib/types'
import { Banner, Card, EmptyState } from '../Primitives'
import { SpinnerIcon } from '../Icons'
import {
  CoverageStrip,
  FailuresByCheck,
  ScoreByQuestion,
  type Failure,
} from '../report/ReportCharts'
import { FailureDetailModal } from '../report/FailureDetailModal'

const PASS_SCORE = 70

function ScoreCard({
  label,
  score,
  weight,
  detail,
  tone = 'neutral',
}: {
  label: string
  score: number | null
  weight?: string
  detail: string
  tone?: 'neutral' | 'final'
}) {
  const value = score === null ? '—' : score.toFixed(0)
  const colour =
    score === null
      ? 'text-ink-faint'
      : score >= PASS_SCORE
        ? 'text-ok'
        : 'text-bad'

  return (
    <div
      className={`rounded-lg border p-3 ${
        tone === 'final' ? 'border-brand bg-brand/5' : 'border-line bg-surface'
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[13px] font-medium uppercase tracking-wider text-ink-muted">{label}</p>
        {weight && <span className="tabular text-[12px] text-ink-faint">{weight}</span>}
      </div>
      <p className={`tabular mt-1.5 text-3xl font-semibold ${colour}`}>
        {value}
        {score !== null && <span className="text-base text-ink-faint"> / 100</span>}
      </p>
      {score !== null && (
        <div className="relative mt-2 h-1.5 rounded-full bg-raised">
          <div
            className={`h-1.5 rounded-full ${score >= PASS_SCORE ? 'bg-ok' : 'bg-bad'}`}
            style={{ width: `${Math.min(100, score)}%` }}
          />
          <div
            className="absolute -top-0.5 h-2.5 w-0.5 rounded bg-ink"
            style={{ left: `${PASS_SCORE}%` }}
            title={`pass mark ${PASS_SCORE}`}
          />
        </div>
      )}
      <p className="mt-1.5 text-[13px] text-ink-faint">{detail}</p>
    </div>
  )
}

export function ReportTab({ refreshKey }: { refreshKey: number }) {
  const [suite, setSuite] = useState<SuiteScore | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const [scores, setScores] = useState<{ id: string; question: string; score: TurnScore }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all([api.sessionScore(), api.session()])
      .then(([scoreResult, sessionResult]) => {
        if (!active) return
        setSuite(scoreResult.suite)
        setScores(scoreResult.turns)
        setTurns(sessionResult.turns)
        setError(null)
      })
      .catch((cause: unknown) =>
        active && setError(cause instanceof Error ? cause.message : 'Could not load the report.'),
      )
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [refreshKey])

  if (loading) {
    return (
      <Card>
        <p className="flex items-center gap-2 text-[15px] text-ink-muted">
          <SpinnerIcon /> Loading report
        </p>
      </Card>
    )
  }

  if (error) return <Banner tone="error">{error}</Banner>

  if (!suite || suite.turns === 0) {
    return (
      <EmptyState
        title="Nothing to report yet"
        hint="Ask some questions on the Demo tab and evaluate them. Their scores roll up here."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <ScoreCard
          label="Rule checks (automated)"
          score={suite.avg_rules}
          weight="weight 30%"
          detail="Deterministic gates. No model, no cost."
        />
        <ScoreCard
          label="LLM judge (AI)"
          score={suite.avg_judge}
          weight="weight 40%"
          detail="A second model scores meaning against four criteria."
        />
        <ScoreCard
          label="Human review (manual)"
          score={suite.avg_human}
          weight="weight 30%"
          detail="A person scores four criteria on a 1-5 rubric."
        />
        <ScoreCard
          label="Final score"
          score={suite.final}
          weight={`pass mark ${PASS_SCORE}`}
          detail={`${suite.evaluated_turns} of ${suite.turns} questions evaluated`}
          tone="final"
        />
      </div>

      {suite.security_failures > 0 && (
        <Banner tone="error">
          <strong>Release blocked.</strong> {suite.security_failures} security check
          failure{suite.security_failures > 1 ? 's' : ''} across {suite.blocked} question
          {suite.blocked > 1 ? 's' : ''}. A security failure is a veto, not a deduction — no
          score is high enough to override it.
        </Banner>
      )}

      <div className="grid gap-3 md:grid-cols-4">
        {[
          { label: 'Passed', value: suite.passed, tone: 'text-ok' },
          { label: 'Failed', value: suite.failed, tone: 'text-bad' },
          { label: 'Blocked', value: suite.blocked, tone: 'text-bad' },
          { label: 'Not evaluated', value: suite.pending, tone: 'text-ink-faint' },
        ].map((entry) => (
          <div key={entry.label} className="rounded-lg border border-line bg-surface p-3">
            <p className="text-[13px] font-medium uppercase tracking-wider text-ink-muted">
              {entry.label}
            </p>
            <p className={`tabular mt-1 text-2xl font-semibold ${entry.tone}`}>{entry.value}</p>
          </div>
        ))}
      </div>

      <Card
        title="How much of the evaluation is done"
        subtitle="A blank method is not a bad score — it just has not been run yet."
      >
        <CoverageStrip turns={turns} total={suite.turns} />
      </Card>

      <Card
        title="Final score by question"
        subtitle="Worst first, so the weakest answers are at the top. Hover to see the question."
      >
        <ScoreByQuestion scores={scores} turns={turns} />
      </Card>

      <Card
        title="What is actually failing"
        subtitle="Every rule failure across every question — this is the list to work through."
      >
        <FailuresByCheck turns={turns} onSelect={setFailure} />
      </Card>

      <Card title="Per-question detail" subtitle="How the final score was reached for each question">
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full min-w-[900px] border-collapse text-left text-[15px]">
            <thead>
              <tr className="bg-raised text-[13px] uppercase tracking-wider text-ink-muted">
                <th scope="col" className="px-3 py-2 font-medium">Question</th>
                <th scope="col" className="px-3 py-2 font-medium">Rules</th>
                <th scope="col" className="px-3 py-2 font-medium">Judge</th>
                <th scope="col" className="px-3 py-2 font-medium">Human</th>
                <th scope="col" className="px-3 py-2 font-medium">Final</th>
                <th scope="col" className="px-3 py-2 font-medium">Verdict</th>
                <th scope="col" className="px-3 py-2 font-medium">Basis</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((entry) => {
                const byKey = Object.fromEntries(
                  entry.score.methods.map((method) => [method.key, method.score]),
                )
                const turn = turns.find((item) => item.id === entry.id)
                return (
                  <tr key={entry.id} className="border-t border-line">
                    <td className="max-w-72 px-3 py-2">
                      <p className="truncate text-[14px] text-ink" title={entry.question}>
                        {entry.question}
                      </p>
                      <p className="tabular text-[12px] text-ink-faint">
                        {turn?.case_id ?? 'typed'} · {turn?.assistant_version.toUpperCase()}
                      </p>
                    </td>
                    {(['rules', 'judge', 'human'] as const).map((key) => (
                      <td key={key} className="tabular px-3 py-2 text-[14px] text-ink">
                        {byKey[key] === null || byKey[key] === undefined
                          ? '—'
                          : (byKey[key] as number).toFixed(0)}
                      </td>
                    ))}
                    <td className="tabular px-3 py-2 text-[14px] font-semibold text-ink">
                      {entry.score.final === null ? '—' : entry.score.final.toFixed(0)}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[12px] font-semibold ${
                          entry.score.verdict === 'pass'
                            ? 'bg-ok/15 text-ok'
                            : entry.score.verdict === 'pending'
                              ? 'bg-raised text-ink-faint'
                              : 'bg-bad/15 text-bad'
                        }`}
                      >
                        {entry.score.verdict.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[13px] text-ink-muted">
                      {entry.score.completeness_label}
                      {entry.score.blocking_reasons.length > 0 && (
                        <span className="block text-bad">
                          {entry.score.blocking_reasons.join('; ')}
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <FailureDetailModal
        open={failure !== null}
        onClose={() => setFailure(null)}
        failure={failure}
        turns={turns}
      />

      <Card title="How the final score is calculated">
        <p className="text-[14px] text-ink-muted">
          Each method is normalised to 0–100, then combined as{' '}
          <span className="tabular text-ink">rules × 0.30 + judge × 0.40 + human × 0.30</span>.
          A method that has not run is excluded and the remaining weights are renormalised, so
          a partly-evaluated answer is never punished for the steps you have not taken yet —
          the basis column above says exactly what each score rests on. Any failed security
          check overrides the arithmetic and blocks release.
        </p>
      </Card>
    </div>
  )
}
