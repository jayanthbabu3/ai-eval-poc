import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import type {
  AssistantVersion,
  HumanRubric,
  JudgeSpec,
  RuleGroup,
  Turn,
} from '../../lib/types'
import { ms } from '../../lib/format'
import { CodeBlock, Modal, ModalSection } from '../ui/Modal'
import { Banner } from '../Primitives'
import { SpinnerIcon } from '../Icons'

const GROUP_LABEL: Record<RuleGroup, string> = {
  security: 'Security',
  grounding: 'Grounding',
  format: 'Format & content',
  performance: 'Performance',
}

const GROUP_QUESTION: Record<RuleGroup, string> = {
  security: 'Would this answer leak something, or obey an attacker?',
  grounding: 'Is every claim traceable to a real article it was given?',
  format: 'Is the answer usable by an employee in a hurry?',
  performance: 'Did it arrive fast enough, and at acceptable cost?',
}

const ORDER: RuleGroup[] = ['security', 'grounding', 'format', 'performance']

/** Small hook so each modal loads its reference data once, on first open. */
function useLoaded<T>(open: boolean, load: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || data) return
    let active = true
    load()
      .then((result) => active && setData(result))
      .catch((cause: unknown) =>
        active && setError(cause instanceof Error ? cause.message : 'Could not load.'),
      )
    return () => {
      active = false
    }
    // `load` is redefined per render by callers; keying on `open` is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return { data, error }
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-[15px] text-ink-muted">
      <SpinnerIcon /> Loading
    </p>
  )
}

// ---------------------------------------------------------------------------

export function RuleCatalogueModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, error } = useLoaded(open, () => api.ruleCatalogue())

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Rule checks — what we validate automatically"
      subtitle="Deterministic gates. No model involved: they run in milliseconds and cost nothing."
      width="lg"
    >
      {error && <Banner tone="error">{error}</Banner>}
      {!data && !error && <Loading />}
      {data && (
        <div className="space-y-5">
          <p className="text-[14px] text-ink-muted">
            {data.count} checks run on every answer. Each one is independent — a failure in
            one never stops the others from reporting, so you always see the full picture.
          </p>
          {ORDER.map((group) => {
            const entries = data.rules.filter((rule) => rule.group === group)
            if (!entries.length) return null
            return (
              <ModalSection
                key={group}
                title={GROUP_LABEL[group]}
                meta={`${entries.length} checks`}
              >
                <p className="mb-2 text-[13px] text-ink-muted">{GROUP_QUESTION[group]}</p>
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {entries.map((rule) => (
                    <li key={rule.name} className="rounded-md border border-line px-3 py-2">
                      <p className="tabular text-[14px] font-medium text-ink">
                        {rule.name.replace(/_/g, ' ')}
                      </p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                        {rule.explanation}
                      </p>
                    </li>
                  ))}
                </ul>
              </ModalSection>
            )
          })}
          <Banner tone="info">
            A failure in the <strong>Security</strong> group blocks release outright,
            regardless of how well the answer scores elsewhere.
          </Banner>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------

export function HumanRubricModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { data, error } = useLoaded<HumanRubric>(open, () => api.humanRubric())

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Human review — what we ask a reviewer"
      subtitle="The manual step. A person reads the answer and scores it against this rubric."
      width="md"
    >
      {error && <Banner tone="error">{error}</Banner>}
      {!data && !error && <Loading />}
      {data && (
        <div className="space-y-3">
          <ol className="space-y-2">
            {data.items.map((item, index) => (
              <li key={item.id} className="rounded-md border border-line bg-canvas p-2.5">
                <p className="text-[14px] font-medium text-ink">
                  <span className="tabular text-brand">{index + 1}.</span> {item.label}
                  <span className="ml-2 rounded bg-raised px-1.5 py-0.5 text-[12px] text-ink-faint">
                    {item.kind === 'scale' ? `1-${data.scale_max}` : 'yes / no'}
                  </span>
                  {!item.scored && (
                    <span className="ml-1 rounded bg-accent/15 px-1.5 py-0.5 text-[12px] text-accent">
                      not averaged
                    </span>
                  )}
                </p>
                <p className="mt-1 text-[13px] text-ink">{item.question}</p>
                <p className="mt-0.5 text-[13px] text-ink-faint">{item.guidance}</p>
              </li>
            ))}
          </ol>
          <Banner tone="info">{data.scoring_note}</Banner>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------

export function JudgeSpecModal({
  open,
  onClose,
  turn,
}: {
  open: boolean
  onClose: () => void
  turn?: Turn | null
}) {
  const { data, error } = useLoaded<JudgeSpec>(open, () => api.judgeSpec())
  const traces = turn?.judge?.traces ?? []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="LLM judge — what we ask the model"
      subtitle="A second model reads the answer and scores it against four criteria."
      width="xl"
    >
      {error && <Banner tone="error">{error}</Banner>}
      {!data && !error && <Loading />}
      {data && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-1.5 text-[13px]">
            <span className="tabular rounded bg-raised px-1.5 py-1 text-ink-muted ring-1 ring-line">
              judge model: {data.judge_model}
            </span>
            <span className="tabular rounded bg-raised px-1.5 py-1 text-ink-muted ring-1 ring-line">
              threshold: {data.threshold}
            </span>
            <span className="tabular rounded bg-raised px-1.5 py-1 text-ink-muted ring-1 ring-line">
              temperature: {data.temperature}
            </span>
          </div>

          <ul className="space-y-2">
            {data.metrics.map((metric) => (
              <li key={metric.name} className="rounded-md border border-line bg-canvas p-2.5">
                <p className="text-[14px] font-medium text-ink">
                  {metric.label}
                  <span className="ml-2 text-[12px] font-normal text-ink-faint">{metric.kind}</span>
                  {metric.needs_reference && (
                    <span className="ml-1.5 rounded bg-accent/15 px-1.5 py-0.5 text-[12px] text-accent">
                      needs a known-good answer
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-[13px] text-ink">{metric.question}</p>
                <p className="mt-1 text-[13px] text-ink-muted">{metric.criteria}</p>
                <p className="mt-1 text-[13px] text-ink-faint">
                  Sent to the judge: {metric.inputs.join(' · ')}
                </p>
              </li>
            ))}
          </ul>

          <Banner tone="info">{data.note}</Banner>

          <section>
            <h3 className="text-[14px] font-semibold text-ink">
              The actual exchange {traces.length > 0 && `(${traces.length} calls)`}
            </h3>
            {traces.length === 0 ? (
              <p className="mt-1 text-[13px] text-ink-muted">
                Run the judge on a question and the verbatim prompts and replies appear here —
                captured as they were sent, not reconstructed.
              </p>
            ) : (
              <div className="mt-2 space-y-2">
                {traces.map((trace, index) => (
                  <details
                    key={`${trace.metric}-${index}`}
                    className="rounded-md border border-line bg-canvas p-2.5"
                  >
                    <summary className="cursor-pointer text-[14px] font-medium capitalize text-ink">
                      {trace.metric} — {trace.stage}
                      <span className="tabular ml-2 text-[13px] font-normal text-ink-faint">
                        {ms(trace.latency_ms)}
                      </span>
                    </summary>
                    <div className="mt-2 space-y-2">
                      <div>
                        <p className="mb-1 text-[13px] font-medium text-ink-muted">
                          System prompt
                        </p>
                        <CodeBlock>{trace.system_prompt}</CodeBlock>
                      </div>
                      <div>
                        <p className="mb-1 text-[13px] font-medium text-ink-muted">
                          Prompt sent to the judge
                        </p>
                        <CodeBlock>{trace.prompt}</CodeBlock>
                      </div>
                      <div>
                        <p className="mb-1 text-[13px] font-medium text-ink-muted">
                          Raw reply from the judge
                        </p>
                        <CodeBlock>{trace.raw_response}</CodeBlock>
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Modal>
  )
}

// ---------------------------------------------------------------------------

export function AssistantVersionModal({
  open,
  onClose,
  versions,
}: {
  open: boolean
  onClose: () => void
  versions: AssistantVersion[]
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Assistant versions — what changed"
      subtitle="The thing being evaluated. Same knowledge base, same model; different instructions and retrieval depth."
      width="xl"
    >
      <div className="grid gap-3 md:grid-cols-2">
        {versions.map((version) => (
          <section key={version.id} className="rounded-md border border-line bg-canvas p-3">
            <h3 className="text-[15px] font-semibold text-ink">{version.label}</h3>
            <p className="mt-0.5 text-[13px] text-ink-muted">{version.tagline}</p>

            <dl className="mt-2 grid grid-cols-2 gap-1 text-[13px]">
              <dt className="text-ink-faint">Model</dt>
              <dd className="tabular text-ink">{version.model}</dd>
              <dt className="text-ink-faint">Articles retrieved</dt>
              <dd className="tabular text-ink">top_k = {version.top_k}</dd>
              <dt className="text-ink-faint">Temperature</dt>
              <dd className="tabular text-ink">{version.temperature}</dd>
            </dl>

            <p className="mt-2.5 text-[13px] font-medium text-ink">Instructions given</p>
            <ul className="mt-1 space-y-0.5">
              {version.highlights.map((line) => (
                <li key={line} className="text-[13px] text-ink-muted">
                  · {line}
                </li>
              ))}
            </ul>

            <p className="mt-2.5 text-[13px] font-medium text-ink">System prompt (verbatim)</p>
            <div className="mt-1">
              <CodeBlock>{version.system_prompt}</CodeBlock>
            </div>
          </section>
        ))}
      </div>
    </Modal>
  )
}

// ---------------------------------------------------------------------------

export function TurnDetailModal({
  open,
  onClose,
  turn,
}: {
  open: boolean
  onClose: () => void
  turn: Turn | null
}) {
  if (!turn) return null

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`${turn.id} — what we sent and what came back`}
      subtitle={turn.question}
      width="xl"
    >
      <div className="space-y-3">
        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">
            1. Articles retrieved ({turn.retrieval.kept.length} kept of{' '}
            {turn.retrieval.candidates.length} scored)
          </h3>
          <ul className="space-y-1">
            {turn.retrieval.candidates.map((chunk) => {
              const kept = turn.retrieval.kept.some((k) => k.document_id === chunk.document_id)
              return (
                <li
                  key={chunk.document_id}
                  className={`rounded border px-2.5 py-1.5 ${
                    kept ? 'border-line bg-canvas' : 'border-line/60 bg-canvas/50 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[13px] font-medium text-ink">
                      <span className="tabular text-brand">{chunk.document_id}</span> {chunk.title}
                    </span>
                    <span className="tabular text-[13px] text-ink-muted">
                      {chunk.score.toFixed(3)} {kept ? '· used' : '· not used'}
                    </span>
                  </div>
                  {kept && <p className="mt-1 text-[13px] text-ink-muted">{chunk.content}</p>}
                </li>
              )
            })}
          </ul>
        </section>

        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">
            2. System prompt ({turn.assistant_label})
          </h3>
          <CodeBlock>{turn.system_prompt}</CodeBlock>
        </section>

        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">
            3. User prompt sent to the model ({turn.prompt_chars.toLocaleString()} chars)
          </h3>
          <CodeBlock>{turn.user_prompt}</CodeBlock>
        </section>

        <section>
          <h3 className="mb-1 text-[14px] font-semibold text-ink">
            4. Answer ({ms(turn.generation.latency_ms)}
            {turn.generation.completion_tokens
              ? ` · ${turn.generation.completion_tokens} tokens`
              : ''}
            )
          </h3>
          <p className="whitespace-pre-wrap rounded-md border border-line bg-canvas p-2.5 text-[15px] text-ink">
            {turn.generation.answer || '(no answer returned)'}
          </p>
        </section>

        {turn.expected_answer && (
          <section>
            <h3 className="mb-1 text-[14px] font-semibold text-ink">
              5. Known-good answer (used to score correctness and completeness)
            </h3>
            <p className="rounded-md border border-line bg-raised p-2.5 text-[14px] text-ink-muted">
              {turn.expected_answer}
            </p>
          </section>
        )}
      </div>
    </Modal>
  )
}
