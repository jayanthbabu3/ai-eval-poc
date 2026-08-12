import { useCallback, useEffect, useState } from 'react'
import { api } from './lib/api'
import type { Health } from './lib/types'
import { Banner } from './components/Primitives'
import { AlertIcon } from './components/Icons'
import { GuideTab } from './components/tabs/GuideTab'
import { DemoTab } from './components/tabs/DemoTab'
import { CompareTab } from './components/tabs/CompareTab'
import { ReportTab } from './components/tabs/ReportTab'
import { KnowledgeTab } from './components/tabs/KnowledgeTab'
import { QuestionsTab } from './components/tabs/QuestionsTab'

type Tab = 'guide' | 'demo' | 'compare' | 'report' | 'knowledge' | 'questions'

const TABS: { key: Tab; label: string; hint: string }[] = [
  { key: 'guide', label: 'Start here', hint: 'What AI evaluation is and why it matters' },
  { key: 'demo', label: 'Demo', hint: 'Ask questions and evaluate the answers' },
  { key: 'compare', label: 'Compare versions', hint: 'V1 against V2 on the same questions' },
  { key: 'report', label: 'Report', hint: 'Scores across everything asked' },
  { key: 'knowledge', label: 'Knowledge base', hint: 'What the assistant is allowed to know' },
  { key: 'questions', label: 'Q&A', hint: 'What AI evaluation is, how each method works, what to measure' },
]

export default function App() {
  const [health, setHealth] = useState<Health | null>(null)
  const [tab, setTab] = useState<Tab>('guide')
  const [error, setError] = useState<string | null>(null)
  // Bumped whenever the session changes, so the Report tab reloads its totals.
  const [sessionVersion, setSessionVersion] = useState(0)

  useEffect(() => {
    api
      .health()
      .then(setHealth)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'Cannot reach the evaluation API.'),
      )
  }, [])

  const onSessionChanged = useCallback(() => setSessionVersion((n) => n + 1), [])

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <div className="mr-auto">
            <h1 className="font-display text-[19px] font-bold tracking-tight text-ink">
              AI Evaluation — IT Knowledge Assistant
            </h1>
            <p className="text-[14px] text-ink-muted">
              Ask · retrieve · answer · evaluate three ways · score
            </p>
          </div>

          {health && (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px]">
              <span
                className={`rounded px-1.5 py-1 ring-1 ${
                  health.groq_configured
                    ? 'bg-ok/15 text-ok ring-ok/30'
                    : 'bg-accent/15 text-accent ring-accent/30'
                }`}
              >
                {health.groq_configured ? 'Groq connected' : 'Offline stub mode'}
              </span>
              <span className="tabular rounded bg-raised px-1.5 py-1 text-ink-muted ring-1 ring-line">
                assistant: {health.generation_model}
              </span>
              <span className="tabular rounded bg-raised px-1.5 py-1 text-ink-muted ring-1 ring-line">
                judge: {health.judge_model}
              </span>
            </div>
          )}
        </div>

        <nav className="mx-auto flex max-w-[1600px] gap-1 px-4">
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              onClick={() => setTab(entry.key)}
              aria-current={tab === entry.key ? 'page' : undefined}
              title={entry.hint}
              className={`min-h-11 cursor-pointer border-b-2 px-3 text-[15px] font-medium transition-colors duration-200 ${
                tab === entry.key
                  ? 'border-brand text-ink'
                  : 'border-transparent text-ink-muted hover:text-ink'
              }`}
            >
              {entry.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {error && <Banner tone="error">{error}</Banner>}

        {health && !health.groq_configured && tab !== 'guide' && (
          <Banner tone="warn">
            <span className="flex items-center gap-2">
              <AlertIcon />
              No Groq credential detected. Answers are offline stubs and the LLM judge is
              skipped — rule checks, human review, and scoring still run. Add GROQ_API_KEY to
              .env and restart the API for a full run.
            </span>
          </Banner>
        )}

        {tab === 'guide' && <GuideTab />}
        {tab === 'demo' && <DemoTab onSessionChanged={onSessionChanged} />}
        {tab === 'compare' && <CompareTab />}
        {tab === 'report' && <ReportTab refreshKey={sessionVersion} />}
        {tab === 'knowledge' && <KnowledgeTab />}
        {tab === 'questions' && <QuestionsTab />}
      </main>
    </div>
  )
}
