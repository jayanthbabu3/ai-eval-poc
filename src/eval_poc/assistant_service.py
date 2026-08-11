"""Orchestrates one live turn: ask, then evaluate it in three separate steps.

Split deliberately: the demo tells a story, and each step has to be triggerable
on its own so the presenter can talk between them.
"""

from __future__ import annotations

import time

from eval_poc.assistants.registry import AssistantVersion, get_version
from eval_poc.config import AppConfig, load_config
from eval_poc.evaluators.human import HumanReviewStore
from eval_poc.evaluators.llm_judge import DeepEvalJudge
from eval_poc.evaluators.rules import evaluate_rules
from eval_poc.generation.assistant import KnowledgeAssistant, build_user_prompt
from eval_poc.knowledge.json_store import build_default_retriever
from eval_poc.knowledge.retriever import Retriever
from eval_poc.llm.groq_client import GroqClient
from eval_poc.models import HumanReview, JudgeReport, RuleReport, TestCase
from eval_poc.scoring import TurnScore, score_suite, score_turn
from eval_poc.session import RetrievalTrace, TranscriptStore, Turn, new_turn_id, now_iso

# Widen the candidate pool beyond what any version keeps, so the UI can show
# what was considered and rejected rather than only what survived.
CANDIDATE_POOL = 5


class TurnNotFoundError(LookupError):
    pass


class AssistantService:
    def __init__(
        self,
        *,
        config: AppConfig | None = None,
        retriever: Retriever | None = None,
        client: GroqClient | None = None,
        judge: DeepEvalJudge | None = None,
        store: TranscriptStore | None = None,
        reviews: HumanReviewStore | None = None,
    ) -> None:
        self._config = config or load_config()
        self._retriever = retriever or build_default_retriever()
        self._client = client or GroqClient()
        self._judge = judge if judge is not None else DeepEvalJudge(self._config.judge)
        self._store = store or TranscriptStore()
        self._reviews = reviews or HumanReviewStore()

    @property
    def judge(self) -> DeepEvalJudge:
        return self._judge

    def _assistant(self, version: AssistantVersion) -> KnowledgeAssistant:
        return KnowledgeAssistant(self._retriever, self._client, version)

    # ---- step 1: ask -----------------------------------------------------

    def ask(
        self,
        question: str,
        *,
        case_id: str | None = None,
        expected_answer: str | None = None,
        version_id: str | None = None,
        persist: bool = True,
    ) -> Turn:
        version = get_version(version_id)
        assistant = self._assistant(version)
        min_score = self._config.retrieval.min_score

        started = time.perf_counter()
        candidates = self._retriever.search(question, CANDIDATE_POOL)
        retrieval_ms = (time.perf_counter() - started) * 1000
        kept = [
            chunk for chunk in candidates[: version.top_k] if chunk.score >= min_score
        ]

        generation = assistant.answer(question, kept)
        user_prompt = build_user_prompt(question, kept)

        turn = Turn(
            id=new_turn_id(),
            asked_at=now_iso(),
            question=question,
            assistant_version=version.id,
            assistant_label=version.label,
            case_id=case_id,
            expected_answer=expected_answer,
            retrieval=RetrievalTrace(
                query=question,
                candidates=candidates,
                kept=kept,
                top_k=version.top_k,
                min_score=min_score,
                duration_ms=round(retrieval_ms, 2),
            ),
            generation=generation,
            prompt_chars=len(user_prompt),
            system_prompt=version.system_prompt,
            user_prompt=user_prompt,
        )
        if persist:
            self._store.upsert(turn)
        return turn

    # ---- step 2: rule checks --------------------------------------------

    def evaluate_rules_for(self, turn: Turn) -> Turn:
        rules: RuleReport = evaluate_rules(
            turn.generation,
            self._config.rules,
            question=turn.question,
            chunks=turn.retrieval.kept,
            case=self._case_for(turn),
        )
        return turn.model_copy(update={"rules": rules})

    def run_rules(self, turn_id: str) -> Turn:
        updated = self.evaluate_rules_for(self._require(turn_id))
        self._store.upsert(updated)
        return updated

    # ---- step 3: LLM judge ----------------------------------------------

    def evaluate_judge_for(self, turn: Turn) -> Turn:
        judge: JudgeReport = self._judge.evaluate(
            None,
            turn.generation,
            turn.retrieval.kept,
            question=turn.question,
            expected_answer=turn.expected_answer,
        )
        return turn.model_copy(update={"judge": judge})

    def run_judge(self, turn_id: str) -> Turn:
        updated = self.evaluate_judge_for(self._require(turn_id))
        self._store.upsert(updated)
        return updated

    # ---- step 4: human review -------------------------------------------

    def save_human_review(self, turn_id: str, review: HumanReview) -> Turn:
        turn = self._require(turn_id)
        self._reviews.save(review)
        updated = turn.model_copy(update={"human": review})
        self._store.upsert(updated)
        return updated

    # ---- version comparison ---------------------------------------------

    def compare(self, case_ids: list[str]) -> dict:
        """Run the same questions through every version and score both.

        Comparison turns are not persisted to the transcript — the demo session
        stays a record of what the presenter actually asked.
        """
        from eval_poc.assistants.registry import list_versions
        from eval_poc.pipeline import load_test_cases

        cases = {case.id: case for case in load_test_cases()}
        selected = [cases[case_id] for case_id in case_ids if case_id in cases]
        if not selected:
            raise ValueError("No known test cases were selected for comparison.")

        versions = list_versions()
        rows = []
        for case in selected:
            per_version = {}
            for version in versions:
                turn = self.ask(
                    case.question,
                    case_id=case.id,
                    expected_answer=case.expected_answer,
                    version_id=version.id,
                    persist=False,
                )
                turn = self.evaluate_judge_for(self.evaluate_rules_for(turn))
                per_version[version.id] = {
                    "turn": turn.model_dump(),
                    "score": turn.score.model_dump(),
                }
            rows.append(
                {
                    "case_id": case.id,
                    "question": case.question,
                    "category": case.category,
                    "versions": per_version,
                }
            )

        return {
            "versions": [version.model_dump() for version in versions],
            "rows": rows,
            "summary": self._compare_summary(rows, [version.id for version in versions]),
        }

    @staticmethod
    def _compare_summary(rows: list[dict], version_ids: list[str]) -> dict:
        summary = {}
        for version_id in version_ids:
            finals = [
                row["versions"][version_id]["score"]["final"]
                for row in rows
                if row["versions"][version_id]["score"]["final"] is not None
            ]
            blocked = sum(
                1 for row in rows if row["versions"][version_id]["score"]["blocked"]
            )
            rule_failures = sum(
                sum(
                    1
                    for check in row["versions"][version_id]["turn"]["rules"]["checks"]
                    if check["status"] == "fail"
                )
                for row in rows
                if row["versions"][version_id]["turn"]["rules"]
            )
            summary[version_id] = {
                "avg_final": round(sum(finals) / len(finals), 1) if finals else None,
                "blocked": blocked,
                "rule_failures": rule_failures,
            }
        return summary

    # ---- reads -----------------------------------------------------------

    def transcript(self) -> list[Turn]:
        return self._store.load()

    def suite_score(self) -> dict:
        turns = self.transcript()
        scores: list[TurnScore] = [
            score_turn(turn.rules, turn.judge, turn.human) for turn in turns
        ]
        return {
            "suite": score_suite(scores).model_dump(),
            "turns": [
                {"id": turn.id, "question": turn.question, "score": score.model_dump()}
                for turn, score in zip(turns, scores)
            ],
        }

    def clear(self) -> None:
        self._store.clear()

    def _case_for(self, turn: Turn) -> TestCase | None:
        if not turn.case_id:
            return None
        from eval_poc.pipeline import load_test_cases

        return next((case for case in load_test_cases() if case.id == turn.case_id), None)

    def _require(self, turn_id: str) -> Turn:
        turn = self._store.get(turn_id)
        if turn is None:
            raise TurnNotFoundError(f"No turn with id {turn_id}")
        return turn
