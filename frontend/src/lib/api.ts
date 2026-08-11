import type {
  AssistantVersion,
  CompareResult,
  Health,
  HumanReview,
  HumanRubric,
  JudgeSpec,
  RuleCatalogueEntry,
  RunPayload,
  SuiteScore,
  TestCase,
  Turn,
  TurnScore,
} from './types'

const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...init,
    })
  } catch {
    throw new Error(
      'Cannot reach the evaluation API. Start it with: uvicorn eval_poc.api:app --reload',
    )
  }

  if (!response.ok) {
    const detail = await response
      .json()
      .then((body: { detail?: string }) => body.detail)
      .catch(() => null)
    throw new Error(detail ?? `Request failed with status ${response.status}`)
  }
  return (await response.json()) as T
}

export const api = {
  health: () => request<Health>('/health'),

  latestRun: () => request<RunPayload>('/run'),

  triggerRun: (useJudge: boolean) =>
    request<RunPayload>('/run', {
      method: 'POST',
      body: JSON.stringify({ use_judge: useJudge }),
    }),

  testCases: () => request<{ count: number; cases: TestCase[] }>('/test-cases'),

  ruleCatalogue: () => request<{ count: number; rules: RuleCatalogueEntry[] }>('/rules'),

  assistants: () => request<{ versions: AssistantVersion[] }>('/assistants'),

  humanRubric: () => request<HumanRubric>('/human-rubric'),

  judgeSpec: () => request<JudgeSpec>('/judge/spec'),

  knowledge: () =>
    request<{
      count: number
      documents: {
        id: string
        title: string
        category: string
        tags: string[]
        content: string
      }[]
    }>('/knowledge'),

  // --- live assistant session ---

  session: () => request<{ count: number; turns: Turn[] }>('/session'),

  ask: (payload: { question: string; case_id?: string | null; version?: string }) =>
    request<Turn>('/session/ask', { method: 'POST', body: JSON.stringify(payload) }),

  sessionScore: () =>
    request<{
      suite: SuiteScore
      turns: { id: string; question: string; score: TurnScore }[]
    }>('/session/score'),

  compare: (caseIds: string[]) =>
    request<CompareResult>('/compare', {
      method: 'POST',
      body: JSON.stringify({ case_ids: caseIds }),
    }),

  runTurnRules: (turnId: string) =>
    request<Turn>(`/session/${turnId}/rules`, { method: 'POST' }),

  runTurnJudge: (turnId: string) =>
    request<Turn>(`/session/${turnId}/judge`, { method: 'POST' }),

  reviewTurn: (
    turnId: string,
    payload: {
      reviewer: string
      correctness: number
      completeness: number
      clarity: number
      tone: number
      ship_it: boolean
      comment: string
    },
  ) =>
    request<Turn>(`/session/${turnId}/review`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  clearSession: () => request<{ cleared: boolean }>('/session', { method: 'DELETE' }),

  reportMarkdown: () => request<{ markdown: string }>('/report/markdown'),

  reviews: () => request<{ count: number; reviews: HumanReview[] }>('/reviews'),

  submitReview: (payload: {
    case_id: string
    reviewer: string
    correctness: number
    clarity: number
    comment: string
  }) =>
    request<{ saved: HumanReview; count: number }>('/reviews', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
}
