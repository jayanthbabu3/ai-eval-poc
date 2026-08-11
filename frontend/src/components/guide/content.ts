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
  what: string
  used: boolean
}

export const TOOLS: ToolRow[] = [
  {
    name: 'DeepEval',
    what: 'Open-source library that scores answers using an LLM judge. Works like pytest, ships ~40 ready-made metrics. This is what this project uses.',
    used: true,
  },
  {
    name: 'RAGAS',
    what: 'Open-source, focused on RAG systems. Strong at measuring whether retrieval found the right documents.',
    used: false,
  },
  {
    name: 'promptfoo',
    what: 'Command-line tool. You describe test cases in a YAML file and it compares prompts and models side by side. Also does red-teaming.',
    used: false,
  },
  {
    name: 'Langfuse / LangSmith',
    what: 'Hosted platforms that record every call your app makes to a model, then let you score those real conversations.',
    used: false,
  },
  {
    name: 'Arize Phoenix',
    what: 'Open-source tracing and evaluation you can run yourself. Good for seeing what happened inside a request.',
    used: false,
  },
  {
    name: 'Giskard',
    what: 'Scans an AI app for weaknesses — bias, made-up facts, prompt injection — and writes a report.',
    used: false,
  },
  {
    name: 'MLflow / Weights & Biases',
    what: 'General machine-learning platforms that added LLM evaluation. Useful if your team already uses them.',
    used: false,
  },
  {
    name: 'Guardrails AI / NeMo Guardrails',
    what: 'Different job: these block a bad answer live, in production, rather than scoring it beforehand.',
    used: false,
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
