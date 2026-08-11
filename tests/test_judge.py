"""Phase 4 tests: the Groq judge adapter and DeepEval integration boundaries.

These never call Groq — the client is stubbed, so the tests cover the parts we
own: schema coercion, error handling, and the skip paths.
"""

from __future__ import annotations

import pytest
from pydantic import BaseModel

from eval_poc.config import JudgeConfig
from eval_poc.evaluators.llm_judge import DeepEvalJudge
from eval_poc.llm.groq_client import ChatResult, GroqUnavailableError
from eval_poc.llm.judge_model import (
    GroqJudgeModel,
    _extract_json_object,
    _with_schema_instructions,
)
from eval_poc.models import Generation, RetrievedChunk, TestCase

CONFIG = JudgeConfig(model="test-judge", temperature=0.0, threshold=0.7)

CASE = TestCase(
    id="TC-1",
    question="q",
    expected_answer="e",
    required_keywords=[],
    category="Identity",
    difficulty="easy",
)

CHUNKS = [RetrievedChunk(document_id="KB-001", title="t", content="c", score=0.5)]


class Verdict(BaseModel):
    score: float
    reason: str


class StubClient:
    """Minimal stand-in for GroqClient."""

    def __init__(self, text: str = '{"score": 0.9, "reason": "ok"}', error: str | None = None):
        self._text = text
        self._error = error
        self.calls: list[dict] = []
        self.available = True

    def complete(self, **kwargs) -> ChatResult:
        self.calls.append(kwargs)
        return ChatResult(
            text=self._text,
            latency_ms=1.0,
            prompt_tokens=1,
            completion_tokens=1,
            stubbed=False,
            error=self._error,
        )


class UnavailableClient(StubClient):
    def __init__(self) -> None:
        super().__init__()
        self.available = False


def test_json_extraction_handles_plain_object() -> None:
    assert _extract_json_object('{"a": 1}') == {"a": 1}


def test_json_extraction_strips_markdown_fences() -> None:
    assert _extract_json_object('```json\n{"a": 1}\n```') == {"a": 1}


def test_json_extraction_recovers_from_surrounding_prose() -> None:
    assert _extract_json_object('Sure! {"a": 1} hope that helps') == {"a": 1}


def test_json_extraction_raises_without_json() -> None:
    with pytest.raises(RuntimeError, match="no JSON object"):
        _extract_json_object("there is no object here")


def test_schema_instructions_are_appended_only_when_needed() -> None:
    assert _with_schema_instructions("prompt", None) == "prompt"
    prompted = _with_schema_instructions("prompt", Verdict)
    assert "JSON schema" in prompted and "score" in prompted


def test_judge_model_requires_a_credential() -> None:
    with pytest.raises(GroqUnavailableError):
        GroqJudgeModel("test-judge", client=UnavailableClient())


def test_judge_model_returns_a_validated_schema_instance() -> None:
    model = GroqJudgeModel("test-judge", client=StubClient())
    result = model.generate("rate this", schema=Verdict)
    assert isinstance(result, Verdict)
    assert result.score == 0.9


def test_judge_model_enables_json_mode_only_with_a_schema() -> None:
    client = StubClient()
    model = GroqJudgeModel("test-judge", client=client)

    model.generate("plain text please")
    assert client.calls[-1]["json_mode"] is False

    model.generate("structured please", schema=Verdict)
    assert client.calls[-1]["json_mode"] is True


def test_judge_model_raises_on_provider_error() -> None:
    model = GroqJudgeModel("test-judge", client=StubClient(error="rate limited"))
    with pytest.raises(RuntimeError, match="rate limited"):
        model.generate("rate this", schema=Verdict)


def test_judge_model_raises_when_json_does_not_match_schema() -> None:
    model = GroqJudgeModel("test-judge", client=StubClient(text='{"wrong": true}'))
    with pytest.raises(RuntimeError, match="does not match Verdict"):
        model.generate("rate this", schema=Verdict)


def test_judge_model_name_is_reported() -> None:
    assert GroqJudgeModel("test-judge", client=StubClient()).get_model_name() == "Groq test-judge"


def test_async_generate_delegates_to_sync() -> None:
    import asyncio

    model = GroqJudgeModel("test-judge", client=StubClient())
    result = asyncio.run(model.a_generate("rate this", schema=Verdict))
    assert isinstance(result, Verdict)


def test_judge_skips_stubbed_generations() -> None:
    judge = DeepEvalJudge(CONFIG)
    report = judge.evaluate(
        CASE, Generation(answer="a", model="m", latency_ms=1.0, stubbed=True), CHUNKS
    )
    assert report.skipped_reason is not None
    assert "offline stub" in report.skipped_reason
    assert report.scores == []


def test_judge_skips_empty_answers() -> None:
    judge = DeepEvalJudge(CONFIG)
    report = judge.evaluate(CASE, Generation(answer="", model="m", latency_ms=1.0), CHUNKS)
    assert report.skipped_reason == "generation produced no answer to judge"


def test_judge_reports_unavailable_instead_of_raising(monkeypatch: pytest.MonkeyPatch) -> None:
    """A missing credential must degrade to 'skipped', never crash the run."""
    judge = DeepEvalJudge(CONFIG)
    monkeypatch.setattr(
        DeepEvalJudge,
        "_build_metrics",
        lambda self: (_ for _ in ()).throw(GroqUnavailableError("no credential")),
    )
    report = judge.evaluate(CASE, Generation(answer="an answer", model="m", latency_ms=1.0), CHUNKS)
    assert report.scores == []
    assert "no credential" in (report.skipped_reason or "")
    assert judge.available is False


def test_judge_records_metric_failures_as_errors_not_zero_scores(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """A judge call that fails must be marked errored, never scored 0.

    Regression: a Groq rate limit once produced four 0.00 scores, which read as
    'the assistant answered terribly' when nothing had actually been judged.
    """

    class ExplodingMetric:
        score = None
        reason = None

        def measure(self, _case):
            raise ValueError("judge exploded")

    judge = DeepEvalJudge(CONFIG)
    monkeypatch.setattr(DeepEvalJudge, "_build_metrics", lambda self: {"correctness": ExplodingMetric()})

    report = judge.evaluate(CASE, Generation(answer="an answer", model="m", latency_ms=1.0), CHUNKS)
    assert len(report.scores) == 1
    entry = report.scores[0]
    assert entry.errored is True
    assert "judge exploded" in (entry.error or "")
    assert entry.passed is False, "an errored metric must never count as passing"
    assert report.passed is False
