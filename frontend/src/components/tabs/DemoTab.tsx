import { useCallback, useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import type { AssistantVersion, TestCase, Turn } from '../../lib/types'
import { Banner, Button, Card } from '../Primitives'
import { PlayIcon, SpinnerIcon } from '../Icons'
import { PipelineTrace } from '../assistant/PipelineTrace'
import { QuestionPicker } from '../demo/QuestionPicker'
import { ChatExchange } from '../demo/ChatExchange'
import { ResultsTable, type Method } from '../demo/ResultsTable'
import {
  HumanReviewModal,
  JudgeResultModal,
  RuleResultModal,
} from '../demo/ResultModals'
import {
  AssistantVersionModal,
  HumanRubricModal,
  JudgeSpecModal,
  RuleCatalogueModal,
  TurnDetailModal,
} from '../modals/MethodModals'

type ModalKind =
  | 'rules-info'
  | 'judge-info'
  | 'human-info'
  | 'version-info'
  | 'turn-detail'
  | 'rules-result'
  | 'judge-result'
  | 'human-result'
  | null

export function DemoTab({ onSessionChanged }: { onSessionChanged: () => void }) {
  const [cases, setCases] = useState<TestCase[]>([])
  const [versions, setVersions] = useState<AssistantVersion[]>([])
  const [versionId, setVersionId] = useState('v2')
  const [turns, setTurns] = useState<Turn[]>([])
  const [draft, setDraft] = useState('')
  const [asking, setAsking] = useState(false)
  const [busyTurnId, setBusyTurnId] = useState<string | null>(null)
  const [busyMethod, setBusyMethod] = useState<Method | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastAskedId, setLastAskedId] = useState<string | null>(null)
  const [modal, setModal] = useState<ModalKind>(null)
  const [modalTurnId, setModalTurnId] = useState<string | null>(null)

  useEffect(() => {
    void (async () => {
      try {
        const [caseResult, versionResult, sessionResult] = await Promise.all([
          api.testCases(),
          api.assistants(),
          api.session(),
        ])
        setCases(caseResult.cases)
        setVersions(versionResult.versions)
        setTurns(sessionResult.turns)
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : 'Could not load the session.')
      }
    })()
  }, [])

  const upsert = useCallback(
    (turn: Turn) => {
      setTurns((current) => {
        const exists = current.some((item) => item.id === turn.id)
        return exists
          ? current.map((item) => (item.id === turn.id ? turn : item))
          : [...current, turn]
      })
      onSessionChanged()
    },
    [onSessionChanged],
  )

  const lastTurn = useMemo(
    () => turns.find((turn) => turn.id === lastAskedId) ?? turns.at(-1) ?? null,
    [turns, lastAskedId],
  )
  const modalTurn = useMemo(
    () => turns.find((turn) => turn.id === modalTurnId) ?? null,
    [turns, modalTurnId],
  )

  const ask = async (question: string, caseId?: string) => {
    setAsking(true)
    setError(null)
    try {
      const turn = await api.ask({ question, case_id: caseId ?? null, version: versionId })
      upsert(turn)
      setLastAskedId(turn.id)
      setDraft('')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The assistant could not answer.')
    } finally {
      setAsking(false)
    }
  }

  const run = async (turn: Turn, method: Method) => {
    // Human review is a form, not a call — open it instead of running anything.
    if (method === 'human') {
      setModalTurnId(turn.id)
      setModal('human-result')
      return
    }

    setBusyTurnId(turn.id)
    setBusyMethod(method)
    setError(null)
    try {
      if (method === 'rules' || method === 'all') {
        upsert(await api.runTurnRules(turn.id))
      }
      if (method === 'judge' || method === 'all') {
        upsert(await api.runTurnJudge(turn.id))
      }
      if (method === 'all') {
        setModalTurnId(turn.id)
        setModal('human-result')
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The evaluation step failed.')
    } finally {
      setBusyTurnId(null)
      setBusyMethod(null)
    }
  }

  const clear = async () => {
    await api.clearSession()
    setTurns([])
    setLastAskedId(null)
    onSessionChanged()
  }

  const openMethodResult = (turn: Turn, method: 'rules' | 'judge' | 'human') => {
    setModalTurnId(turn.id)
    setModal(`${method}-result` as ModalKind)
  }

  return (
    <div className="space-y-4">
      {error && <Banner tone="error">{error}</Banner>}

      <Card
        step={1}
        title="Ask the knowledge assistant"
        subtitle="A working IT service-desk assistant. Every question becomes a row in the results table."
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md bg-surface p-0.5 ring-1 ring-line">
              {versions.map((version) => (
                <button
                  key={version.id}
                  type="button"
                  onClick={() => setVersionId(version.id)}
                  title={version.tagline}
                  className={`cursor-pointer rounded px-2.5 py-1.5 text-[14px] font-medium transition-colors duration-200 ${
                    versionId === version.id
                      ? 'bg-brand text-white'
                      : 'text-ink-muted hover:text-ink'
                  }`}
                >
                  {version.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setModal('version-info')}
              className="cursor-pointer text-[13px] text-brand underline decoration-dotted underline-offset-2"
            >
              what differs?
            </button>
          </div>
        }
      >
        <QuestionPicker
          cases={cases}
          disabled={asking}
          onPick={(testCase) => void ask(testCase.question, testCase.id)}
        />

        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim().length >= 3) void ask(draft.trim())
          }}
        >
          <label className="flex-1">
            <span className="sr-only">Your question</span>
            <input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="…or type your own question"
              className="w-full rounded-md border border-line bg-canvas px-3 py-2.5 text-[15px] text-ink placeholder:text-ink-faint"
            />
          </label>
          <Button type="submit" disabled={asking || draft.trim().length < 3}>
            {asking ? <SpinnerIcon /> : <PlayIcon />}
            Ask
          </Button>
        </form>

        <p className="mt-2 text-[13px] text-ink-faint">
          The suggested questions carry a known-good answer, so all four judge metrics apply.
          A question you type has none, so only faithfulness and relevancy can be scored.
        </p>
      </Card>

      <Card
        step={2}
        title="The assistant answers"
        subtitle="What an employee would actually see."
        bodyClassName="bg-chat p-4"
        action={
          turns.length > 0 ? (
            <Button variant="ghost" onClick={() => void clear()}>
              Clear session
            </Button>
          ) : undefined
        }
      >
        <div className="mx-auto max-w-3xl">
          {!lastTurn && !asking ? (
            <p className="py-10 text-center text-[15px] text-ink-faint">
              Pick a question above and the assistant replies here.
            </p>
          ) : (
            <ChatExchange turn={asking ? null : lastTurn} pending={asking} />
          )}
        </div>
      </Card>

      {lastTurn && (
        <Card
          step={3}
          title="What happened behind that answer"
          subtitle="The retrieval and generation steps. Every figure is measured, not simulated."
        >
          <PipelineTrace turn={lastTurn} animate={lastTurn.id === lastAskedId} />
        </Card>
      )}

      <Card
        step={4}
        title="Results and evaluation"
        subtitle="One row per question. Run each method independently or all at once — the ⓘ on each column explains what it does."
      >
        <ResultsTable
          turns={turns}
          busyTurnId={busyTurnId}
          busyMethod={busyMethod}
          onRun={(turn, method) => void run(turn, method)}
          onOpenTurn={(turn) => {
            setModalTurnId(turn.id)
            setModal('turn-detail')
          }}
          onOpenMethod={openMethodResult}
          onOpenMethodInfo={(method) => setModal(`${method}-info` as ModalKind)}
        />
      </Card>

      {/* Reference modals — "what does this method actually do?" */}
      <RuleCatalogueModal open={modal === 'rules-info'} onClose={() => setModal(null)} />
      <HumanRubricModal open={modal === 'human-info'} onClose={() => setModal(null)} />
      <JudgeSpecModal
        open={modal === 'judge-info'}
        onClose={() => setModal(null)}
        turn={modalTurn}
      />
      <AssistantVersionModal
        open={modal === 'version-info'}
        onClose={() => setModal(null)}
        versions={versions}
      />

      {/* Result modals — "what did this method say about this answer?" */}
      <TurnDetailModal
        open={modal === 'turn-detail'}
        onClose={() => setModal(null)}
        turn={modalTurn}
      />
      <RuleResultModal
        open={modal === 'rules-result'}
        onClose={() => setModal(null)}
        turn={modalTurn}
      />
      <JudgeResultModal
        open={modal === 'judge-result'}
        onClose={() => setModal(null)}
        turn={modalTurn}
        onViewPrompts={() => setModal('judge-info')}
      />
      <HumanReviewModal
        open={modal === 'human-result'}
        onClose={() => setModal(null)}
        turn={modalTurn}
        onSaved={upsert}
        onViewRubric={() => setModal('human-info')}
      />
    </div>
  )
}
