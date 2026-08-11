export interface TestCase {
  id: string
  question: string
  expected_answer: string
  required_keywords: string[]
  category: string
  difficulty: string
}

export interface RetrievedChunk {
  document_id: string
  title: string
  content: string
  score: number
}

export interface Generation {
  answer: string
  model: string
  latency_ms: number
  prompt_tokens: number
  completion_tokens: number
  stubbed: boolean
  error: string | null
}

export interface RuleCheck {
  name: string
  status: 'pass' | 'fail'
  detail: string
  group: RuleGroup
  is_security: boolean
  explanation: string
}

export interface JudgeScore {
  metric: string
  score: number
  threshold: number
  reason: string
  error: string | null
}

export interface HumanReview {
  case_id: string
  reviewer: string
  correctness: number
  completeness: number
  clarity: number
  tone: number
  ship_it: boolean
  comment: string
  reviewed_at: string
}

export interface EvalRecord {
  case: TestCase
  chunks: RetrievedChunk[]
  generation: Generation
  rules: { checks: RuleCheck[] }
  judge: { scores: JudgeScore[]; skipped_reason: string | null }
  human: HumanReview | null
}

export interface Summary {
  total_cases: number
  passed_cases: number
  failed_cases: number
  pass_rate: number
  fail_rate: number
  rule_pass_rate: number
  rule_checks_total: number
  rule_checks_passed: number
  security_violations: number
  avg_correctness: number | null
  avg_completeness: number | null
  avg_faithfulness: number | null
  avg_relevancy: number | null
  avg_latency_ms: number
  p95_latency_ms: number
  max_latency_ms: number
  avg_human_correctness: number | null
  avg_human_clarity: number | null
  human_reviewed_cases: number
  judged_cases: number
  generated_at: string
}

export interface RunPayload {
  summary: Summary
  config: {
    judge: { threshold: number; model: string }
    generation: { model: string }
    rules: { max_latency_ms: number }
    scoring: { pass_threshold: number; human_scale_max: number }
  }
  records: EvalRecord[]
}

export interface Health {
  status: string
  groq_configured: boolean
  generation_model: string
  judge_model: string
  judge_threshold: number
  has_saved_run: boolean
}

/** A case passes when all rules pass and every judge metric clears its threshold. */
export function recordPassed(record: EvalRecord): boolean {
  const rulesOk = record.rules.checks.every((check) => check.status === 'pass')
  if (!rulesOk) return false
  if (record.judge.skipped_reason !== null) return true
  return (
    record.judge.scores.length > 0 &&
    record.judge.scores.every((score) => score.score >= score.threshold)
  )
}

// ---------------------------------------------------------------------------
// Live assistant session
// ---------------------------------------------------------------------------

export type RuleGroup = 'security' | 'grounding' | 'format' | 'performance'

export interface RuleCatalogueEntry {
  name: string
  group: RuleGroup
  explanation: string
  is_security: boolean
}

export interface RetrievalTrace {
  query: string
  candidates: RetrievedChunk[]
  kept: RetrievedChunk[]
  top_k: number
  min_score: number
  duration_ms: number
}

export interface Turn {
  id: string
  asked_at: string
  question: string
  assistant_version: string
  assistant_label: string
  case_id: string | null
  expected_answer: string | null
  retrieval: RetrievalTrace
  generation: Generation
  prompt_chars: number
  system_prompt: string
  user_prompt: string
  rules: { checks: RuleCheck[] } | null
  judge: {
    scores: JudgeScore[]
    skipped_reason: string | null
    unscorable: Record<string, string>
    traces: JudgeCallTrace[]
  } | null
  human: HumanReview | null
  score: TurnScore
}

export type Verdict = 'pending' | 'pass' | 'fail' | 'blocked'

export interface MethodScore {
  key: 'rules' | 'judge' | 'human'
  label: string
  score: number | null
  weight: number
  detail: string
}

export interface TurnScore {
  methods: MethodScore[]
  final: number | null
  methods_run: number
  methods_total: number
  is_complete: boolean
  completeness_label: string
  blocked: boolean
  blocking_reasons: string[]
  verdict: Verdict
}

export interface SuiteScore {
  turns: number
  evaluated_turns: number
  avg_rules: number | null
  avg_judge: number | null
  avg_human: number | null
  final: number | null
  passed: number
  failed: number
  blocked: number
  pending: number
  security_failures: number
}

export interface AssistantVersion {
  id: string
  label: string
  tagline: string
  model: string
  system_prompt: string
  top_k: number
  temperature: number
  max_tokens: number
  highlights: string[]
}

export interface RubricItem {
  id: string
  label: string
  question: string
  guidance: string
  kind: 'scale' | 'boolean'
  scored: boolean
}

export interface HumanRubric {
  scale_max: number
  scored_criteria: string[]
  items: RubricItem[]
  scoring_note: string
}

export interface JudgeMetricSpec {
  name: string
  label: string
  kind: string
  question: string
  criteria: string
  needs_reference: boolean
  inputs: string[]
}

export interface JudgeSpec {
  judge_model: string
  threshold: number
  temperature: number
  metrics: JudgeMetricSpec[]
  note: string
}

export interface JudgeCallTrace {
  metric: string
  stage: string
  system_prompt: string
  prompt: string
  raw_response: string
  latency_ms: number
}

export interface CompareRow {
  case_id: string
  question: string
  category: string
  versions: Record<string, { turn: Turn; score: TurnScore }>
}

export interface CompareResult {
  versions: AssistantVersion[]
  rows: CompareRow[]
  summary: Record<
    string,
    { avg_final: number | null; blocked: number; rule_failures: number }
  >
}

export function hasGroundTruth(turn: Turn): boolean {
  return Boolean(turn.expected_answer && turn.expected_answer.trim())
}
