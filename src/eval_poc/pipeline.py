"""Orchestrates the five evaluation phases over the whole test suite."""

from __future__ import annotations

import json
from collections.abc import Callable, Iterable
from pathlib import Path

from eval_poc.config import DATA_DIR, AppConfig, load_config
from eval_poc.evaluators.human import HumanReviewStore
from eval_poc.evaluators.llm_judge import DeepEvalJudge
from eval_poc.evaluators.rules import evaluate_rules
from eval_poc.assistants.registry import get_version
from eval_poc.generation.assistant import KnowledgeAssistant
from eval_poc.knowledge.json_store import build_default_retriever
from eval_poc.knowledge.retriever import Retriever
from eval_poc.llm.groq_client import GroqClient
from eval_poc.models import EvalRecord, JudgeReport, TestCase

ProgressHook = Callable[[int, int, str], None]


def load_test_cases(path: Path | None = None) -> list[TestCase]:
    source = path or DATA_DIR / "test_cases.json"
    try:
        raw = json.loads(source.read_text(encoding="utf-8"))
    except FileNotFoundError as error:
        raise RuntimeError(f"Test cases missing at {source}") from error
    except json.JSONDecodeError as error:
        raise RuntimeError(f"Test cases at {source} are not valid JSON: {error}") from error

    cases = [TestCase.model_validate(item) for item in raw.get("cases", [])]
    if not cases:
        raise RuntimeError(f"Test case file at {source} contains no cases")
    return cases


class EvaluationPipeline:
    """Phases 1-5 for one test case, and for the suite."""

    def __init__(
        self,
        *,
        config: AppConfig | None = None,
        retriever: Retriever | None = None,
        client: GroqClient | None = None,
        judge: DeepEvalJudge | None = None,
        review_store: HumanReviewStore | None = None,
        version_id: str | None = None,
    ) -> None:
        self._config = config or load_config()
        self._assistant = KnowledgeAssistant(
            retriever or build_default_retriever(),
            client or GroqClient(),
            get_version(version_id),
        )
        self._judge = judge if judge is not None else DeepEvalJudge(self._config.judge)
        self._reviews = review_store or HumanReviewStore()

    @property
    def config(self) -> AppConfig:
        return self._config

    def evaluate_case(self, case: TestCase, *, use_judge: bool = True) -> EvalRecord:
        chunks, generation = self._assistant.run(
            case.question, self._config.retrieval.min_score
        )
        rules = evaluate_rules(
            generation,
            self._config.rules,
            question=case.question,
            chunks=chunks,
            case=case,
        )
        judge = (
            self._judge.evaluate(case, generation, chunks)
            if use_judge
            else JudgeReport(skipped_reason="LLM judge disabled for this run")
        )
        return EvalRecord(
            case=case,
            chunks=chunks,
            generation=generation,
            rules=rules,
            judge=judge,
            human=self._reviews.latest_by_case().get(case.id),
        )

    def run(
        self,
        cases: Iterable[TestCase] | None = None,
        *,
        use_judge: bool = True,
        on_progress: ProgressHook | None = None,
    ) -> list[EvalRecord]:
        suite = list(cases) if cases is not None else load_test_cases()
        records: list[EvalRecord] = []
        for index, case in enumerate(suite, start=1):
            if on_progress:
                on_progress(index, len(suite), case.id)
            records.append(self.evaluate_case(case, use_judge=use_judge))
        return records
