/** Reference content for the Guide tab, kept as data so the page stays layout. */

export interface MethodRow {
  method: string
  who: string
  speed: string
  cost: string
  catches: string
  misses: string
}

export const METHODS: MethodRow[] = [
  {
    method: 'Rule checks',
    who: 'Code. No model involved.',
    speed: 'Milliseconds',
    cost: 'Free',
    catches: 'Leaked secrets, missing citations, invented numbers, slow answers, wrong format',
    misses: 'Anything about meaning — a fluent, well-formatted, completely wrong answer passes',
  },
  {
    method: 'LLM as a judge',
    who: 'A second AI model reads the answer and scores it',
    speed: 'Seconds',
    cost: 'Paid, per answer',
    catches: 'Wrong facts, missing steps, off-topic answers, claims not in the source',
    misses: 'It is a model too — it can be wrong, and can score the same answer differently twice',
  },
  {
    method: 'Human review',
    who: 'A person',
    speed: 'Minutes',
    cost: 'Expensive',
    catches: 'Everything, including tone and "would I actually send this?"',
    misses: 'Cannot scale — you review a sample, not every answer',
  },
]

export interface MetricRow {
  name: string
  question: string
  note: string
}

export const METRICS: MetricRow[] = [
  {
    name: 'Correctness',
    question: 'Is the answer factually right?',
    note: 'Needs a known-good answer to compare against.',
  },
  {
    name: 'Completeness',
    question: 'Did it cover everything the user needs?',
    note: 'Also needs a known-good answer.',
  },
  {
    name: 'Faithfulness (or groundedness)',
    question: 'Is every claim supported by the source documents?',
    note: 'This is the hallucination check. No known-good answer needed.',
  },
  {
    name: 'Answer relevancy',
    question: 'Did it answer the question that was asked?',
    note: 'Catches padding and answers that drift off the point.',
  },
  {
    name: 'Context precision / recall',
    question: 'Did the search step find the right documents?',
    note: 'Measures retrieval, not the model. A bad answer often starts here.',
  },
  {
    name: 'Safety checks',
    question: 'Did it leak data, or obey an attacker?',
    note: 'Covers secrets, personal data, and prompt injection.',
  },
  {
    name: 'Latency and cost',
    question: 'Was it fast and cheap enough to run for real?',
    note: 'A correct answer nobody waits for is still a failed answer.',
  },
]

export interface ToolRow {
  name: string
  kind: string
  whatItIs: string
  useWhen: string
  benefit: string
  watchOut: string
  used: boolean
}

export const TOOLS: ToolRow[] = [
  {
    name: 'DeepEval',
    kind: 'Python library',
    whatItIs:
      'Runs an LLM judge against ready-made metrics. Written like pytest, so evaluations are just tests you can run in CI.',
    useWhen:
      'You have a Python codebase and want scored, explainable answers without writing your own judge prompts.',
    benefit:
      'About 40 metrics out of the box, each returning a score AND a written reason. You can plug in any model as the judge.',
    watchOut:
      'Heavy dependency tree — it pins you below Python 3.13. Each metric costs model calls, so a full run is not free.',
    used: true,
  },
  {
    name: 'RAGAS',
    kind: 'Python library',
    whatItIs:
      'Evaluation built specifically for retrieval-augmented systems, with strong metrics for the search step.',
    useWhen:
      'Your main worry is whether the search found the right documents — not whether the model wrote well.',
    benefit:
      'Context precision and recall are its speciality. A bad RAG answer usually starts with bad retrieval, and this measures that directly.',
    watchOut:
      'Narrower than DeepEval. If you also need tone, safety, or custom criteria you will end up adding a second tool.',
    used: false,
  },
  {
    name: 'promptfoo',
    kind: 'Command-line tool',
    whatItIs:
      'You describe test cases in a YAML file and it runs them across prompts and models, printing a comparison table.',
    useWhen:
      'You want to try five prompt variants or three models against the same questions and see which wins — without writing code.',
    benefit:
      'Fastest way to A/B prompts. No Python needed, and it has a solid built-in red-teaming mode for attack testing.',
    watchOut:
      'Config-file driven, so complex custom logic is awkward. Less natural to embed inside an existing application.',
    used: false,
  },
  {
    name: 'Langfuse / LangSmith',
    kind: 'Hosted platform',
    whatItIs:
      'Records every call your live app makes to a model, then lets you score those real conversations.',
    useWhen:
      'You are already in production and want to know how the assistant performs on real user questions, not a fixed test set.',
    benefit:
      'Catches what a curated test set never will — the questions you did not think to write. Also gives cost and latency dashboards.',
    watchOut:
      'Your prompts and user data leave your network unless you self-host. Usually needs an account and a paid plan at volume.',
    used: false,
  },
  {
    name: 'Arize Phoenix',
    kind: 'Open-source, self-hosted',
    whatItIs:
      'Tracing and evaluation you run on your own machine. Shows what happened at each step inside a request.',
    useWhen:
      'You need to debug a specific bad answer — which documents were retrieved, what prompt was sent, where it went wrong.',
    benefit:
      'Production-style observability without sending anything to a third party. Good middle ground for regulated environments.',
    watchOut:
      'It is a debugging tool first, a scoring tool second. Not a replacement for a proper test suite.',
    used: false,
  },
  {
    name: 'Giskard',
    kind: 'Scanner',
    whatItIs:
      'Points itself at your AI app, probes it for weaknesses, and writes a report of what it found.',
    useWhen:
      'Before a launch or a security review, when you want an independent sweep for bias, hallucination and prompt injection.',
    benefit:
      'Finds problems you did not think to test for. It generates the attacks itself rather than making you write them.',
    watchOut:
      'A point-in-time audit, not something you run on every commit. Findings still need a human to triage.',
    used: false,
  },
  {
    name: 'MLflow / Weights & Biases',
    kind: 'ML platform',
    whatItIs:
      'General machine-learning platforms that added LLM evaluation alongside their existing experiment tracking.',
    useWhen:
      'Your team already runs one of them for other models and you want evaluation results in the same place.',
    benefit:
      'One dashboard for everything, and run history you keep for free — useful for showing improvement over months.',
    watchOut:
      'Their LLM-specific metrics are less mature than the dedicated tools. Not worth adopting for this alone.',
    used: false,
  },
  {
    name: 'Galileo',
    kind: 'Hosted platform',
    whatItIs:
      'Evaluation and observability for LLM apps and agents. Notable for scoring with small purpose-built evaluator models rather than a large general LLM.',
    useWhen:
      'You are running at volume and judging every response with a big model has become too slow or too expensive.',
    benefit:
      'Much cheaper and faster per evaluation than a frontier-model judge, plus production monitoring and guardrails in the same product.',
    watchOut:
      'Commercial and hosted, so it needs an account and budget. Its evaluators are its own models, so you trade some control for the speed.',
    used: false,
  },
  {
    name: 'Confident AI',
    kind: 'Hosted platform',
    whatItIs:
      'The commercial cloud built by the DeepEval team — the same metrics, plus dashboards, run history and team sharing.',
    useWhen:
      'You started with DeepEval locally and now want results stored, shared and tracked over time without building that yourself.',
    benefit:
      'No migration: the tests you already wrote keep working, they just report somewhere central.',
    watchOut:
      'Results leave your machine. Fine for most teams, a blocker in a regulated environment.',
    used: false,
  },
  {
    name: 'Guardrails AI / NeMo Guardrails',
    kind: 'Runtime guard',
    whatItIs:
      'Sits in front of the model in production and blocks or rewrites a bad answer before the user sees it.',
    useWhen:
      'Always, eventually — but alongside evaluation, never instead of it.',
    benefit:
      'Protects real users in real time. Evaluation tells you the assistant leaks credentials; a guardrail stops it happening.',
    watchOut:
      'A different job entirely. It cannot tell you whether your assistant is any good, only stop the worst outputs.',
    used: false,
  },
]

export interface DecisionRow {
  worry: string
  reach: string
}

/** The short answer to "which one should I use?" */
export const DECISIONS: DecisionRow[] = [
  {
    worry: 'Is the answer correct and complete?',
    reach: 'DeepEval — custom criteria plus ready-made metrics, with written reasons',
  },
  {
    worry: 'Did the search find the right documents?',
    reach: 'RAGAS — context precision and recall are what it does best',
  },
  {
    worry: 'Which prompt or model is better?',
    reach: 'promptfoo — a YAML file and one command gives you a comparison table',
  },
  {
    worry: 'How is it doing with real users right now?',
    reach: 'Langfuse or LangSmith — they score live traffic, not a test set',
  },
  {
    worry: 'Why did this one answer go wrong?',
    reach: 'Arize Phoenix — step-by-step tracing inside the request',
  },
  {
    worry: 'Can someone attack or trick it?',
    reach: 'Giskard to find the holes, promptfoo red-teaming to test them repeatedly',
  },
  {
    worry: 'How do I stop a bad answer reaching a user?',
    reach: 'Guardrails AI or NeMo Guardrails — blocking at runtime, not scoring',
  },
]

export interface ProviderRow {
  provider: string
  baseUrl: string
  note: string
}

/** Any OpenAI-compatible endpoint works for both the assistant and the judge. */
export const PROVIDERS: ProviderRow[] = [
  {
    provider: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    note: 'What this project ships with. Fast and free to start, but the free tier caps daily tokens.',
  },
  {
    provider: 'Ollama (local)',
    baseUrl: 'http://localhost:11434/v1',
    note: 'Runs on your own machine. No key, no rate limit, no data leaves the laptop — slower on modest hardware.',
  },
  {
    provider: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    note: 'Strongest judges available, and priced accordingly.',
  },
  {
    provider: 'Together / OpenRouter / Fireworks',
    baseUrl: 'provider-specific /v1 URL',
    note: 'Aggregators — useful for trying many open models behind one key.',
  },
  {
    provider: 'vLLM / LM Studio',
    baseUrl: 'http://localhost:8000/v1',
    note: 'Self-hosted serving for a model your organisation runs itself.',
  },
]

export interface GlossaryRow {
  term: string
  meaning: string
}

export const GLOSSARY: GlossaryRow[] = [
  { term: 'LLM', meaning: 'Large Language Model — the AI that writes the answer, such as Llama or GPT.' },
  { term: 'Prompt', meaning: 'The text we send to the model. It contains our rules, the documents, and the question.' },
  { term: 'System prompt', meaning: 'The standing instructions to the model: what it must and must not do.' },
  { term: 'Token', meaning: 'A chunk of text, roughly ¾ of a word. Models are billed per token.' },
  { term: 'Knowledge base (KB)', meaning: 'The documents the assistant is allowed to answer from.' },
  { term: 'Retrieval', meaning: 'Searching the knowledge base for the documents most likely to answer the question.' },
  { term: 'RAG', meaning: 'Retrieval-Augmented Generation — search first, then let the model answer using only what was found.' },
  { term: 'Grounding', meaning: 'Keeping the answer tied to the documents, so the model does not make things up.' },
  { term: 'Hallucination', meaning: 'When the model states something confidently that is simply not true.' },
  { term: 'Ground truth', meaning: 'The known-good answer, written by a person, used to mark the model.' },
  { term: 'Threshold', meaning: 'The score an answer must reach to count as a pass. Ours is 0.70 per judge metric.' },
  { term: 'Regression', meaning: 'When something that used to work quietly stops working after a change.' },
  { term: 'Prompt injection', meaning: 'An attack where the user hides instructions in their question to hijack the assistant.' },
  { term: 'Temperature', meaning: 'How much randomness the model uses. Lower means steadier, more repeatable answers.' },
]
