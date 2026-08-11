import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type { AssistantVersion, CompareResult, CompareRow, TestCase } from '../../lib/types'
import { Banner, Button, Card, EmptyState } from '../Primitives'
import { PlayIcon, SpinnerIcon } from '../Icons'
import { AssistantVersionModal } from '../modals/MethodModals'
import { CompareDiagram } from '../guide/CompareDiagram'
import { CompareDetailModal } from '../compare/CompareDetailModal'

const DEFAULT_SELECTION = ['TC-001', 'TC-002', 'TC-010']

function Delta({ value }: { value: number | null }) {
  if (value === null) return <span className="text-ink-faint">—</span>
  const rounded = Math.round(value * 10) / 10
  if (rounded === 0) return <span className="tabular text-ink-faint">0</span>
  return (
    <span className={`tabular font-semibold ${rounded > 0 ? 'text-ok' : 'text-bad'}`}>
      {rounded > 0 ? '+' : ''}
      {rounded}
    </span>
  )
}

export function CompareTab() {
  const [cases, setCases] = useState<TestCase[]>([])
  const [versions, setVersions] = useState<AssistantVersion[]>([])
  const [selected, setSelected] = useState<string[]>(DEFAULT_SELECTION)
  const [result, setResult] = useState<CompareResult | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showVersions, setShowVersions] = useState(false)
  const [detailRow, setDetailRow] = useState<CompareRow | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [caseResult, versionResult] = await Promise.all([
          api.testCases(),
          api.assistants(),
        ])
        setCases(caseResult.cases)
        setVersions(versionResult.versions)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load questions.')
      }
    })()
  }, [])

  const toggle = (caseId: string) =>
    setSelected((current) =>
      current.includes(caseId)
        ? current.filter((id) => id !== caseId)
        : [...current, caseId],
    )

  const run = async () => {
    setRunning(true)
    setError(null)
    try {
      setResult(await api.compare(selected))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The comparison failed.')
    } finally {
      setRunning(false)
    }
  }

  const [v1, v2] = versions
  const summary = result?.summary

  /* A version scored on rules+judge cannot be honestly compared with one scored
     on rules alone — a failed judge call would masquerade as an improvement.
     Flag any row where the two versions did not run the same set of methods. */
  const methodsUsed = (entry: { score: { methods: { key: string; score: number | null }[] } }) =>
    entry.score.methods
      .filter((method) => method.score !== null)
      .map((method) => method.key)
      .sort()
      .join(',')

  const unevenRows =
    result && v1 && v2
      ? result.rows.filter(
          (row) => methodsUsed(row.versions[v1.id]) !== methodsUsed(row.versions[v2.id]),
        )
      : []

  return (
    <div className="space-y-4">
      {error && <Banner tone="error">{error}</Banner>}

      <Card
        title="Did the change actually make it better?"
        subtitle="We improved the assistant. This proves whether it worked, instead of guessing."
      >
        <div className="space-y-4">
          <p className="text-[15px] leading-relaxed text-ink">
            We ask <strong>both versions the same questions</strong>, then score both with the
            same rules and the same judge. Whichever scores higher is genuinely better — not
            because someone preferred the wording, but because it was measured.
          </p>

          <CompareDiagram questionCount={selected.length} />

          <div className="grid gap-3 md:grid-cols-2">
            {versions.map((version) => (
              <div key={version.id} className="rounded-lg border border-line p-3">
                <p className="font-display text-[16px] font-semibold text-ink">
                  {version.label}
                </p>
                <p className="mt-0.5 text-[14px] text-ink-muted">{version.tagline}</p>
                <ul className="mt-2 space-y-1">
                  {version.highlights.slice(0, 3).map((line) => (
                    <li key={line} className="flex gap-1.5 text-[13px] text-ink-muted">
                      <span className="text-ink-faint">·</span>
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setShowVersions(true)}
            className="cursor-pointer text-[14px] text-brand underline decoration-dotted underline-offset-2"
          >
            See both prompts side by side →
          </button>

          <div>
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[15px] font-medium text-ink">
                Which questions should both versions answer?
              </p>
              <span className="text-[13px] text-ink-faint">
                {selected.length} of {cases.length} selected
              </span>
            </div>

            <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-3">
              {cases.map((testCase) => {
                const chosen = selected.includes(testCase.id)
                return (
                  <label
                    key={testCase.id}
                    className={`flex cursor-pointer gap-2 rounded-md border p-2.5 transition-colors duration-200 ${
                      chosen
                        ? 'border-brand bg-brand-soft'
                        : 'border-line hover:border-line-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={chosen}
                      onChange={() => toggle(testCase.id)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand"
                    />
                    <span>
                      <span className="tabular block text-[12px] text-ink-faint">
                        {testCase.id} · {testCase.category}
                        {testCase.difficulty === 'adversarial' && (
                          <span className="ml-1 text-warn">· edge case</span>
                        )}
                      </span>
                      <span className="mt-0.5 block text-[14px] text-ink">
                        {testCase.question}
                      </span>
                    </span>
                  </label>
                )
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-line bg-raised p-3">
            <p className="text-[14px] text-ink-muted">
              Both versions will answer these {selected.length} question(s) and be scored
              automatically. That is about {selected.length * 2 * 5} calls to the model, so give
              it a minute.
            </p>
            <Button onClick={() => void run()} disabled={running || selected.length === 0}>
              {running ? <SpinnerIcon /> : <PlayIcon />}
              {running ? 'Running both versions' : 'Run comparison'}
            </Button>
          </div>
        </div>
      </Card>

      {running && (
        <Banner tone="info">
          Running both versions through {selected.length} question(s). Rule checks and judge
          scoring run for each — this takes a minute.
        </Banner>
      )}

      {!result && !running && (
        <EmptyState
          title="Nothing compared yet"
          hint="Press Run comparison above. You will get a score out of 100 for each version, the difference between them, and — for every question — which rule checks V2 fixed and which it broke."
        />
      )}

      {result && summary && v1 && v2 && (
        <>
          {unevenRows.length > 0 && (
            <Banner tone="warn">
              <strong>Not a like-for-like comparison.</strong> On{' '}
              {unevenRows.length === 1
                ? `1 question (${unevenRows[0].case_id})`
                : `${unevenRows.length} questions`}{' '}
              the two versions were not scored by the same methods — usually because a judge
              call failed on one side. The difference shown there reflects which checks ran,
              not which version is better. Re-run once the judge is available.
            </Banner>
          )}

          <Card title="Verdict" subtitle="Averaged across every compared question">
            <div className="grid gap-3 md:grid-cols-3">
              {[v1, v2].map((version) => (
                <div
                  key={version.id}
                  className="rounded-lg border border-line bg-surface p-3"
                >
                  <p className="text-[13px] font-medium uppercase tracking-wider text-ink-muted">
                    {version.label}
                  </p>
                  <p className="tabular mt-1 text-3xl font-semibold text-ink">
                    {summary[version.id]?.avg_final?.toFixed(0) ?? '—'}
                    <span className="text-base text-ink-faint"> / 100</span>
                  </p>
                  <p className="mt-1 text-[13px] text-ink-faint">
                    {summary[version.id]?.rule_failures ?? 0} rule failures ·{' '}
                    {summary[version.id]?.blocked ?? 0} blocked
                  </p>
                </div>
              ))}

              <div className="rounded-lg border border-brand bg-brand/5 p-3">
                <p className="text-[13px] font-medium uppercase tracking-wider text-ink-muted">
                  Improvement
                </p>
                <p className="tabular mt-1 text-3xl font-semibold">
                  <Delta
                    value={
                      summary[v2.id]?.avg_final !== null && summary[v1.id]?.avg_final !== null
                        ? (summary[v2.id]!.avg_final as number) -
                          (summary[v1.id]!.avg_final as number)
                        : null
                    }
                  />
                </p>
                <p className="mt-1 text-[13px] text-ink-faint">
                  {(summary[v1.id]?.rule_failures ?? 0) - (summary[v2.id]?.rule_failures ?? 0)}{' '}
                  fewer rule failures in {v2.label}
                </p>
              </div>
            </div>
          </Card>

          <Card title="Question by question">
            <div className="overflow-x-auto rounded-lg border border-line">
              <table className="w-full min-w-[1000px] border-collapse text-left text-[15px]">
                <thead>
                  <tr className="bg-raised text-[13px] uppercase tracking-wider text-ink-muted">
                    <th scope="col" className="px-3 py-2 font-medium">Question</th>
                    <th scope="col" className="px-3 py-2 font-medium">{v1.label}</th>
                    <th scope="col" className="px-3 py-2 font-medium">{v2.label}</th>
                    <th scope="col" className="px-3 py-2 font-medium">Δ</th>
                    <th scope="col" className="px-3 py-2 font-medium">What changed</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => {
                    const a = row.versions[v1.id]
                    const b = row.versions[v2.id]
                    const failsA =
                      a.turn.rules?.checks.filter((c) => c.status === 'fail').map((c) => c.name) ??
                      []
                    const failsB =
                      b.turn.rules?.checks.filter((c) => c.status === 'fail').map((c) => c.name) ??
                      []
                    const fixed = failsA.filter((name) => !failsB.includes(name))
                    const introduced = failsB.filter((name) => !failsA.includes(name))

                    return (
                      <tr
                        key={row.case_id}
                        onClick={() => setDetailRow(row)}
                        className="cursor-pointer border-t border-line align-top transition-colors duration-200 hover:bg-raised"
                      >
                        <td className="max-w-64 px-3 py-2">
                          <p className="tabular text-[13px] font-medium text-brand">
                            {row.case_id}
                          </p>
                          <p className="text-[14px] text-ink">{row.question}</p>
                          <p className="mt-1 text-[13px] text-brand underline decoration-dotted underline-offset-2">
                            see both answers and the full working →
                          </p>
                        </td>
                        {[a, b].map((entry, index) => {
                          const byKey = Object.fromEntries(
                            entry.score.methods.map((m) => [m.key, m.score]),
                          )
                          const rulesReport = entry.turn.rules
                          return (
                            <td key={index} className="px-3 py-2">
                              <p className="tabular text-[17px] font-semibold text-ink">
                                {entry.score.final?.toFixed(0) ?? '—'}
                                <span
                                  className={`ml-2 text-[12px] font-semibold ${
                                    entry.score.verdict === 'pass' ? 'text-ok' : 'text-bad'
                                  }`}
                                >
                                  {entry.score.verdict.toUpperCase()}
                                </span>
                              </p>
                              <p className="tabular mt-0.5 text-[12px] text-ink-muted">
                                rules {byKey.rules?.toFixed(0) ?? '—'}
                                {rulesReport &&
                                  ` (${rulesReport.checks.filter((c) => c.status === 'pass').length}/${rulesReport.checks.length})`}{' '}
                                · judge {byKey.judge?.toFixed(0) ?? '—'}
                              </p>
                              <p className="mt-1 max-w-56 truncate text-[13px] text-ink-muted">
                                {entry.turn.generation.answer}
                              </p>
                            </td>
                          )
                        })}
                        <td className="px-3 py-2">
                          <Delta
                            value={
                              b.score.final !== null && a.score.final !== null
                                ? b.score.final - a.score.final
                                : null
                            }
                          />
                        </td>
                        <td className="px-3 py-2 text-[13px]">
                          {fixed.length > 0 && (
                            <p className="text-ok">fixed: {fixed.join(', ')}</p>
                          )}
                          {introduced.length > 0 && (
                            <p className="text-bad">new: {introduced.join(', ')}</p>
                          )}
                          {fixed.length === 0 && introduced.length === 0 && (
                            <p className="text-ink-faint">same rule outcome</p>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[13px] text-ink-faint">
              Every comparison runs the 17 rule checks and all four judge metrics on both
              versions. Human review is not included — nobody has scored these by hand — so its
              30% is shared between the two methods that did run. Click any row to see the
              full working.
            </p>
          </Card>
        </>
      )}

      <AssistantVersionModal
        open={showVersions}
        onClose={() => setShowVersions(false)}
        versions={versions}
      />

      <CompareDetailModal
        open={detailRow !== null}
        onClose={() => setDetailRow(null)}
        row={detailRow}
        versions={versions}
      />
    </div>
  )
}
