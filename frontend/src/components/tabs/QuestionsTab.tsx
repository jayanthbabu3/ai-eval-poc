import { useMemo, useState } from 'react'
import { Card } from '../Primitives'
import { ChevronIcon } from '../Icons'
import { CATEGORIES, QUESTIONS, type QA } from '../qa/content'

/**
 * An explanation of AI evaluation, in question form, searchable.
 *
 * Answers render as prose rather than bullet lists: someone reading to
 * understand the subject needs the reasoning joined up, not keywords they have
 * to assemble themselves. Measured column width keeps long text readable.
 */
function Answer({ entry }: { entry: QA }) {
  return (
    <div className="border-t border-line bg-surface px-4 py-4">
      <div className="max-w-[75ch] space-y-3">
        {entry.answer.map((paragraph, index) => (
          <p key={index} className="text-[15px] leading-[1.7] text-ink">
            {paragraph}
          </p>
        ))}

        {entry.example && (
          <pre className="tabular overflow-x-auto rounded-md border border-line bg-canvas p-3 text-[13px] leading-relaxed text-ink">
            {entry.example}
          </pre>
        )}

        {entry.showThem && (
          <p className="rounded-md border border-brand/30 bg-brand-soft px-3 py-2 text-[14px] text-brand">
            <strong>See it here:</strong> {entry.showThem}
          </p>
        )}
      </div>
    </div>
  )
}

export function QuestionsTab() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>('All')
  const [open, setOpen] = useState<Set<string>>(new Set())

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return QUESTIONS.filter((entry) => {
      if (category !== 'All' && entry.category !== category) return false
      if (!needle) return true
      return [entry.question, ...entry.answer, entry.example ?? '']
        .join(' ')
        .toLowerCase()
        .includes(needle)
    })
  }, [query, category])

  const grouped = useMemo(() => {
    const map = new Map<string, QA[]>()
    for (const entry of visible) {
      map.set(entry.category, [...(map.get(entry.category) ?? []), entry])
    }
    return map
  }, [visible])

  const toggle = (id: string) =>
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allOpen = open.size === visible.length && visible.length > 0

  return (
    <div className="space-y-4">
      <Card
        title="Understanding AI evaluation"
        subtitle={`${QUESTIONS.length} questions explaining the subject — what it is, how each method works, and what to measure.`}
        action={
          <button
            type="button"
            onClick={() =>
              setOpen(allOpen ? new Set() : new Set(visible.map((entry) => entry.id)))
            }
            className="min-h-9 cursor-pointer rounded-md border border-line bg-surface px-3 text-[14px] font-medium text-ink transition-colors duration-200 hover:border-brand hover:text-brand"
          >
            {allOpen ? 'Collapse all' : 'Expand all'}
          </button>
        }
      >
        <div className="space-y-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search — try 'threshold', 'faithfulness', 'how do you write a rule', 'deepeval'"
            className="w-full rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint"
          />

          <div className="flex flex-wrap gap-1.5">
            {['All', ...CATEGORIES].map((name) => (
              <button
                key={name}
                type="button"
                onClick={() => setCategory(name)}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[13px] transition-colors duration-200 ${
                  category === name
                    ? 'border-brand bg-brand text-white'
                    : 'border-line bg-surface text-ink-muted hover:text-ink'
                }`}
              >
                {name}
              </button>
            ))}
          </div>

          <p className="text-[13px] text-ink-faint">
            Showing {visible.length} of {QUESTIONS.length}. Some answers link to the screen
            where you can see the thing being described.
          </p>
        </div>
      </Card>

      {[...grouped.entries()].map(([name, entries]) => (
        <Card key={name} title={name} subtitle={`${entries.length} question(s)`}>
          <ol className="space-y-2">
            {entries.map((entry) => {
              const isOpen = open.has(entry.id)
              return (
                <li key={entry.id} className="overflow-hidden rounded-lg border border-line">
                  <button
                    type="button"
                    onClick={() => toggle(entry.id)}
                    aria-expanded={isOpen}
                    className={`flex w-full cursor-pointer items-start gap-2 px-4 py-3 text-left transition-colors duration-200 ${
                      isOpen ? 'bg-raised' : 'hover:bg-raised'
                    }`}
                  >
                    <ChevronIcon
                      className={`mt-1 h-3.5 w-3.5 shrink-0 text-ink-faint transition-transform duration-200 ${
                        isOpen ? 'rotate-90' : ''
                      }`}
                    />
                    <span className="text-[15px] font-medium text-ink">{entry.question}</span>
                  </button>
                  {isOpen && <Answer entry={entry} />}
                </li>
              )
            })}
          </ol>
        </Card>
      ))}

      {visible.length === 0 && (
        <Card>
          <p className="py-6 text-center text-[15px] text-ink-muted">
            Nothing matches that search. Try a broader word, or clear the category filter.
          </p>
        </Card>
      )}
    </div>
  )
}
