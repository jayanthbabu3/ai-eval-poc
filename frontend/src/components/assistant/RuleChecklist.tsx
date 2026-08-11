import { useEffect, useState } from 'react'
import type { RuleCheck, RuleGroup } from '../../lib/types'
import { CheckIcon, CrossIcon, ShieldIcon } from '../Icons'

const GROUP_LABEL: Record<RuleGroup, string> = {
  security: 'Security',
  grounding: 'Grounding',
  format: 'Format & content',
  performance: 'Performance',
}

const GROUP_BLURB: Record<RuleGroup, string> = {
  security: 'Would this answer leak something, or obey an attacker?',
  grounding: 'Is every claim traceable to a real article it was given?',
  format: 'Is the answer usable by an employee in a hurry?',
  performance: 'Did it arrive fast enough, and at acceptable cost?',
}

const ORDER: RuleGroup[] = ['security', 'grounding', 'format', 'performance']

/** Reveals checks one by one so an audience can read them as they land. */
const REVEAL_MS = 90

export function RuleChecklist({ checks, animate }: { checks: RuleCheck[]; animate: boolean }) {
  const [revealed, setRevealed] = useState(animate ? 0 : checks.length)

  useEffect(() => {
    if (!animate) {
      setRevealed(checks.length)
      return
    }
    setRevealed(0)
    const timers = checks.map((_, index) =>
      setTimeout(() => setRevealed(index + 1), REVEAL_MS * (index + 1)),
    )
    return () => timers.forEach(clearTimeout)
  }, [checks, animate])

  const ordered = ORDER.flatMap((group) => checks.filter((check) => check.group === group))
  const passed = checks.filter((check) => check.status === 'pass').length

  return (
    <div className="space-y-3">
      <p className="tabular text-[14px] text-ink-muted">
        {passed}/{checks.length} checks passed
      </p>

      {ORDER.map((group) => {
        const groupChecks = checks.filter((check) => check.group === group)
        if (groupChecks.length === 0) return null
        const groupPassed = groupChecks.filter((check) => check.status === 'pass').length

        return (
          <section key={group}>
            <header className="mb-1.5 flex items-baseline gap-2">
              <h4 className="text-[14px] font-semibold text-ink">{GROUP_LABEL[group]}</h4>
              <span className="tabular text-[13px] text-ink-faint">
                {groupPassed}/{groupChecks.length}
              </span>
              <span className="text-[13px] text-ink-faint">{GROUP_BLURB[group]}</span>
            </header>
            <ul className="space-y-1">
              {groupChecks.map((check) => {
                const position = ordered.findIndex((item) => item.name === check.name)
                const shown = revealed > position
                const failed = check.status === 'fail'
                return (
                  <li
                    key={check.name}
                    title={check.explanation}
                    className={`flex items-start gap-2 rounded-md border px-2.5 py-1.5 transition-opacity duration-200 ${
                      shown ? 'opacity-100' : 'opacity-0'
                    } ${
                      failed ? 'border-bad/40 bg-bad/5' : 'border-line bg-canvas'
                    }`}
                  >
                    <span className={`mt-0.5 ${failed ? 'text-bad' : 'text-ok'}`}>
                      {failed ? <CheckIconFail /> : <CheckIcon className="h-3.5 w-3.5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[14px] font-medium text-ink">
                        {check.is_security && <ShieldIcon className="h-3 w-3 text-accent" />}
                        {check.name.replace(/_/g, ' ')}
                        <span
                          className={`ml-auto text-[12px] font-semibold ${
                            failed ? 'text-bad' : 'text-ok'
                          }`}
                        >
                          {failed ? 'FAIL' : 'PASS'}
                        </span>
                      </p>
                      <p className="tabular mt-0.5 break-words text-[13px] text-ink-muted">
                        {check.detail}
                      </p>
                      {failed && check.explanation && (
                        <p className="mt-1 text-[13px] text-ink-faint">Why it matters: {check.explanation}</p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

function CheckIconFail() {
  return <CrossIcon className="h-3.5 w-3.5" />
}
