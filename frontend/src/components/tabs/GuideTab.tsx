import type { ReactNode } from 'react'
import { Card } from '../Primitives'
import { FlowDiagram } from '../guide/FlowDiagram'
import {
  DECISIONS,
  GLOSSARY,
  METHODS,
  METRICS,
  PROVIDERS,
  TOOLS,
} from '../guide/content'

const SECTIONS = [
  { id: 'what', label: 'What is AI evaluation?' },
  { id: 'why', label: 'Why we need it' },
  { id: 'how', label: 'The three ways to check' },
  { id: 'metrics', label: 'What people measure' },
  { id: 'tools', label: 'Tools and libraries' },
  { id: 'assistant', label: 'How our assistant works' },
  { id: 'here', label: 'How we evaluate it here' },
  { id: 'glossary', label: 'Words you will hear' },
]

function Section({
  id,
  title,
  lead,
  children,
}: {
  id: string
  title: string
  lead?: string
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <Card title={title} subtitle={lead}>
        <div className="space-y-3 text-[15px] leading-relaxed text-ink">{children}</div>
      </Card>
    </section>
  )
}

function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="w-full min-w-[640px] border-collapse text-left text-[14px]">
        <thead>
          <tr className="border-b border-line bg-raised text-[13px] uppercase tracking-wider text-ink-muted">
            {head.map((cell) => (
              <th key={cell} scope="col" className="px-3 py-2 font-medium">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

export function GuideTab() {
  return (
    <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)]">
      <nav className="hidden xl:block">
        <div className="sticky top-28 rounded-xl border border-line bg-surface p-3">
          <p className="mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-muted">
            On this page
          </p>
          <ol className="space-y-1">
            {SECTIONS.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="flex gap-2 rounded px-2 py-1 text-[14px] text-ink-muted transition-colors duration-200 hover:bg-raised hover:text-brand"
                >
                  <span className="tabular text-ink-faint">{index + 1}</span>
                  {section.label}
                </a>
              </li>
            ))}
          </ol>
        </div>
      </nav>

      <div className="space-y-4">
        <Section
          id="what"
          title="What is AI evaluation?"
          lead="Start here if this is all new."
        >
          <p>
            Normal software is easy to test. You give it the same input twice and you get the
            same output twice, so a test can simply check that the result equals what you
            expected.
          </p>
          <p>AI is not like that, for two reasons:</p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              Ask the same question twice and you get two different sentences. Both can be
              correct. Checking for an exact match is useless.
            </li>
            <li>
              The model will happily give a wrong answer in the same confident tone as a right
              one. Nothing crashes. There is no error message.
            </li>
          </ul>
          <p className="rounded-md border border-line bg-raised p-3">
            <strong>AI evaluation</strong> is how we measure the quality of AI answers in a way
            that can be repeated. Instead of "did it match exactly?", we ask "how good was it?"
            and put a number on it — so we can compare versions, spot when things get worse, and
            show evidence before going live.
          </p>
        </Section>

        <Section id="why" title="Why we need it" lead="The problems it prevents.">
          <p>
            Without evaluation, the only way to know if an AI feature works is for someone to
            try a few questions and say "seems fine". That falls apart quickly:
          </p>
          <ul className="ml-5 list-disc space-y-1.5">
            <li>
              <strong>Things break silently.</strong> Your provider updates the model, someone
              edits the prompt, a document changes — and answers quietly get worse. Nobody
              notices until a user complains.
            </li>
            <li>
              <strong>Made-up answers.</strong> The model can invent a policy, a deadline, or a
              web address that does not exist. In an IT service desk that means an employee
              follows instructions that were never real.
            </li>
            <li>
              <strong>Security.</strong> A user can hide instructions inside a question to try
              to make the assistant reveal something it should not.
            </li>
            <li>
              <strong>You cannot improve what you cannot measure.</strong> If you change the
              prompt, was it actually better? Without scores, it is an opinion.
            </li>
          </ul>
          <p>
            The point of a project like this one is to replace "seems fine" with a number, a
            reason, and a record.
          </p>
        </Section>

        <Section
          id="how"
          title="The three ways to check an answer"
          lead="Each one catches what the others miss, so serious teams use all three."
        >
          <Table head={['Method', 'Who does it', 'Speed', 'Cost', 'Catches', 'Misses']}>
            {METHODS.map((row) => (
              <tr key={row.method} className="border-t border-line align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.method}</td>
                <td className="px-3 py-2 text-ink-muted">{row.who}</td>
                <td className="px-3 py-2 text-ink-muted">{row.speed}</td>
                <td className="px-3 py-2 text-ink-muted">{row.cost}</td>
                <td className="px-3 py-2 text-ink-muted">{row.catches}</td>
                <td className="px-3 py-2 text-ink-muted">{row.misses}</td>
              </tr>
            ))}
          </Table>
          <p>
            Think of it as three filters of different sizes. Rule checks are cheap and catch
            obvious problems on every single answer. The judge is slower but understands
            meaning. A human has the final word, on a sample.
          </p>
        </Section>

        <Section
          id="metrics"
          title="What people measure"
          lead="The terms you will see in every evaluation tool."
        >
          <Table head={['Metric', 'The question it answers', 'Note']}>
            {METRICS.map((row) => (
              <tr key={row.name} className="border-t border-line align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.name}</td>
                <td className="px-3 py-2 text-ink-muted">{row.question}</td>
                <td className="px-3 py-2 text-ink-muted">{row.note}</td>
              </tr>
            ))}
          </Table>
          <p className="rounded-md border border-line bg-raised p-3">
            <strong>Important:</strong> correctness and completeness need a{' '}
            <em>known-good answer</em> written by a person. If a user types a brand-new
            question, there is nothing to compare against, so only faithfulness and relevancy
            can be measured. That is exactly why teams build a fixed set of test questions
            instead of just trying the chatbot.
          </p>
        </Section>

        <Section
          id="tools"
          title="Tools and libraries"
          lead="You do not have to build this from scratch — but you do have to pick."
        >
          <p>
            There are a dozen credible options and they do not compete so much as cover
            different jobs. The quickest way to choose is to start from what worries you:
          </p>

          <Table head={['What you are worried about', 'What to reach for']}>
            {DECISIONS.map((row) => (
              <tr key={row.worry} className="border-t border-line align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.worry}</td>
                <td className="px-3 py-2 text-ink-muted">{row.reach}</td>
              </tr>
            ))}
          </Table>

          <h3 className="pt-2 text-[16px] font-semibold text-ink">Each tool in detail</h3>

          <div className="space-y-2">
            {TOOLS.map((tool) => (
              <article
                key={tool.name}
                className={`rounded-lg border p-3 ${
                  tool.used ? 'border-ok/40 bg-ok-soft' : 'border-line'
                }`}
              >
                <header className="flex flex-wrap items-baseline gap-2">
                  <h4 className="text-[15px] font-semibold text-ink">{tool.name}</h4>
                  <span className="rounded bg-raised px-1.5 py-0.5 text-[12px] text-ink-muted ring-1 ring-line">
                    {tool.kind}
                  </span>
                  {tool.used && (
                    <span className="rounded bg-ok px-1.5 py-0.5 text-[12px] font-semibold text-white">
                      used in this project
                    </span>
                  )}
                </header>

                <p className="mt-1.5 text-[14px] text-ink">{tool.whatItIs}</p>

                <dl className="mt-2 grid gap-x-4 gap-y-1.5 sm:grid-cols-3">
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-ink-faint">
                      Use it when
                    </dt>
                    <dd className="text-[13px] text-ink-muted">{tool.useWhen}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-ok">
                      What you gain
                    </dt>
                    <dd className="text-[13px] text-ink-muted">{tool.benefit}</dd>
                  </div>
                  <div>
                    <dt className="text-[12px] font-semibold uppercase tracking-wide text-warn">
                      Watch out for
                    </dt>
                    <dd className="text-[13px] text-ink-muted">{tool.watchOut}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>

          <p className="rounded-md border border-line bg-raised p-3">
            <strong>This project uses DeepEval</strong> because it runs locally like pytest,
            ships the four metrics we needed, returns a written reason with every score, and
            lets you plug in any model as the judge. If retrieval quality were the main
            concern, RAGAS would be the better starting point; if the goal were comparing
            prompts quickly, promptfoo would.
          </p>

          <h3 className="pt-2 text-[16px] font-semibold text-ink">
            Which models and providers work
          </h3>
          <p>
            Both the assistant and the judge talk to an <strong>OpenAI-compatible</strong> chat
            endpoint, so any of these can drive them. What changes is the base URL and the key.
          </p>

          <Table head={['Provider', 'Base URL', 'Notes']}>
            {PROVIDERS.map((row) => (
              <tr key={row.provider} className="border-t border-line align-top">
                <td className="px-3 py-2 font-medium text-ink">{row.provider}</td>
                <td className="tabular px-3 py-2 text-[13px] text-ink-muted">{row.baseUrl}</td>
                <td className="px-3 py-2 text-ink-muted">{row.note}</td>
              </tr>
            ))}
          </Table>

          <p className="rounded-md border border-warn/40 bg-warn-soft p-3 text-[14px]">
            <strong>Note on this build:</strong> the client as committed points at Groq only.
            Pointing it at Ollama or anything else means passing a <code>base_url</code> when
            the client is constructed — a one-line change in{' '}
            <span className="tabular">src/eval_poc/llm/groq_client.py</span>. Running locally
            with Ollama removes the rate limits entirely and keeps every question on your own
            machine, which is often the better choice for a demo.
          </p>

          <p>
            A real deployment usually ends up with two or three of these tools, not one: a
            library like DeepEval for the test suite, a hosted platform for live traffic, and a
            guardrail in front of the model in production.
          </p>
        </Section>

        <Section
          id="assistant"
          title="How our assistant works"
          lead="The thing being evaluated in this project."
        >
          <p>
            We built an <strong>IT knowledge assistant</strong>: an employee asks a question
            about company IT policy, and it answers from 12 official articles. It is not
            allowed to answer from general knowledge.
          </p>
          <FlowDiagram />
          <ol className="ml-5 list-decimal space-y-1.5">
            <li>
              <strong>The question arrives</strong> — for example "How do I get VPN access?"
            </li>
            <li>
              <strong>We search the knowledge base.</strong> All 12 articles are scored for
              relevance and the best 3 are kept. This step is called{' '}
              <em>retrieval</em>.
            </li>
            <li>
              <strong>We build a prompt.</strong> It contains our rules ("only use these
              articles, cite them, never reveal credentials"), the 3 articles, and the
              question.
            </li>
            <li>
              <strong>The LLM writes the answer</strong> using only what we gave it.
            </li>
            <li>
              <strong>The answer comes back</strong> with the article IDs it used, so any claim
              can be traced.
            </li>
          </ol>
          <p className="rounded-md border border-line bg-raised p-3">
            This pattern — search first, then answer from what you found — is called{' '}
            <strong>RAG</strong>. It is how most company AI assistants are built, because it
            keeps answers tied to documents you control and lets you update knowledge by
            editing a file rather than retraining a model.
          </p>
        </Section>

        <Section
          id="here"
          title="How we evaluate it here"
          lead="What the other tabs actually do."
        >
          <p>
            Every answer the assistant gives can be checked three ways, and each check is a
            separate button so you can see them one at a time:
          </p>
          <Table head={['Step', 'What runs', 'Result']}>
            <tr className="border-t border-line align-top">
              <td className="px-3 py-2 font-medium text-ink">Rule checks</td>
              <td className="px-3 py-2 text-ink-muted">
                17 automatic checks across security, grounding, format and speed
              </td>
              <td className="px-3 py-2 text-ink-muted">A score out of 17, instantly</td>
            </tr>
            <tr className="border-t border-line align-top">
              <td className="px-3 py-2 font-medium text-ink">LLM judge</td>
              <td className="px-3 py-2 text-ink-muted">
                DeepEval scores correctness, completeness, faithfulness and relevancy using a
                second model
              </td>
              <td className="px-3 py-2 text-ink-muted">
                Four scores from 0 to 1, each with a written reason
              </td>
            </tr>
            <tr className="border-t border-line align-top">
              <td className="px-3 py-2 font-medium text-ink">Human review</td>
              <td className="px-3 py-2 text-ink-muted">
                A person rates correctness, completeness, clarity and tone, then answers "would
                you send this?"
              </td>
              <td className="px-3 py-2 text-ink-muted">Four ratings out of 5</td>
            </tr>
          </Table>
          <p>
            The three are combined into one <strong>final score out of 100</strong> — rule
            checks 30%, judge 40%, human 30%. A method you have not run yet is left out rather
            than counted as zero, and the app says so.
          </p>
          <p className="rounded-md border border-bad/30 bg-bad-soft p-3">
            <strong>One rule overrides the maths:</strong> if any security check fails, the
            answer is <strong>blocked</strong> no matter how high it scored. A leaked password
            is not made acceptable by fast, well-written prose.
          </p>
          <ul className="ml-5 list-disc space-y-1">
            <li>
              <strong>Demo</strong> — ask questions and run the three checks on each answer.
            </li>
            <li>
              <strong>Compare versions</strong> — the same questions through two versions of
              the assistant, to prove whether a change actually helped.
            </li>
            <li>
              <strong>Report</strong> — the scores across everything asked.
            </li>
            <li>
              <strong>Knowledge base</strong> — the 12 articles it is allowed to use.
            </li>
          </ul>
        </Section>

        <Section id="glossary" title="Words you will hear">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {GLOSSARY.map((row) => (
              <div key={row.term} className="border-b border-line pb-2">
                <dt className="text-[14px] font-semibold text-ink">{row.term}</dt>
                <dd className="text-[14px] text-ink-muted">{row.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      </div>
    </div>
  )
}
