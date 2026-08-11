import { useState } from 'react'
import type { TestCase } from '../../lib/types'
import { AlertIcon, ChevronIcon } from '../Icons'

/**
 * Question picker showing the actual question text.
 *
 * An audience cannot learn anything from "TC-003 · Identity" — they need to read
 * what is being asked. Edge cases are separated because those are the moments
 * worth pausing on: an attack and an out-of-scope question behave differently
 * from a routine lookup, and that difference is the point of the demo.
 */
export function QuestionPicker({
  cases,
  disabled,
  onPick,
}: {
  cases: TestCase[]
  disabled: boolean
  onPick: (testCase: TestCase) => void
}) {
  const [expanded, setExpanded] = useState(false)

  const routine = cases.filter((entry) => entry.difficulty !== 'adversarial')
  const edge = cases.filter((entry) => entry.difficulty === 'adversarial')
  const visible = expanded ? routine : routine.slice(0, 4)

  return (
    <div className="space-y-3">
      <section>
        <header className="mb-1.5 flex items-baseline justify-between">
          <h3 className="text-[14px] font-medium text-ink">Everyday questions</h3>
          <span className="tabular text-[13px] text-ink-faint">
            {routine.length} available
          </span>
        </header>

        <div className="grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          {visible.map((testCase) => (
            <button
              key={testCase.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(testCase)}
              className="group cursor-pointer rounded-md border border-line bg-canvas p-2.5 text-left transition-colors duration-200 hover:border-brand hover:bg-brand/5 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="tabular text-[12px] font-medium text-ink-faint">
                {testCase.id} · {testCase.category}
              </span>
              <p className="mt-0.5 line-clamp-2 text-[14px] text-ink group-hover:text-brand">
                {testCase.question}
              </p>
            </button>
          ))}
        </div>

        {routine.length > 4 && (
          <button
            type="button"
            onClick={() => setExpanded((current) => !current)}
            className="mt-1.5 inline-flex cursor-pointer items-center gap-1 text-[13px] text-brand hover:underline"
          >
            <ChevronIcon
              className={`h-3 w-3 transition-transform duration-200 ${
                expanded ? 'rotate-90' : ''
              }`}
            />
            {expanded ? 'Show fewer' : `Show all ${routine.length}`}
          </button>
        )}
      </section>

      {edge.length > 0 && (
        <section>
          <header className="mb-1.5 flex items-center gap-1.5">
            <AlertIcon className="h-3.5 w-3.5 text-accent" />
            <h3 className="text-[14px] font-medium text-ink">Edge cases worth demonstrating</h3>
          </header>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {edge.map((testCase) => (
              <button
                key={testCase.id}
                type="button"
                disabled={disabled}
                onClick={() => onPick(testCase)}
                className="group cursor-pointer rounded-md border border-accent/40 bg-accent/5 p-2.5 text-left transition-colors duration-200 hover:border-accent hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="tabular text-[12px] font-medium text-accent">
                  {testCase.id} · {testCase.category}
                </span>
                <p className="mt-0.5 line-clamp-2 text-[14px] text-ink">{testCase.question}</p>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
