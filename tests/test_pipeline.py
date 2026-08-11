"""Integration tests: the pipeline wiring, human review store, and API contract."""

from __future__ import annotations

from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from eval_poc.config import load_config
from eval_poc.evaluators.human import HumanReviewStore, new_review
from eval_poc.evaluators.llm_judge import DeepEvalJudge
from eval_poc.llm.groq_client import GroqClient
from eval_poc.models import Generation, JudgeReport, RetrievedChunk, TestCase
from eval_poc.pipeline import EvaluationPipeline, load_test_cases


class StubRetriever:
    """Fixed chunk, so pipeline tests never depend on ranking behaviour."""

    def search(self, query: str, top_k: int) -> list[RetrievedChunk]:
        return [
            RetrievedChunk(
                document_id="KB-001",
                title="VPN access",
                content="Raise a ticket and get manager approval, then install GlobalProtect.",
                score=0.9,
            )
        ][:top_k]


class StubJudge(DeepEvalJudge):
    def __init__(self) -> None:  # noqa: D107 - deliberately skips the real constructor
        pass

    def evaluate(self, case, generation, chunks) -> JudgeReport:  # type: ignore[override]
        return JudgeReport(skipped_reason="stubbed in tests")


def test_test_cases_load_and_validate() -> None:
    cases = load_test_cases()
    assert len(cases) >= 10
    assert all(isinstance(case, TestCase) for case in cases)
    assert len({case.id for case in cases}) == len(cases)


def test_offline_client_produces_a_stub_generation() -> None:
    # Empty string forces offline; None would fall back to the ambient .env.
    client = GroqClient(api_key="")
    assert client.available is False
    result = client.complete(
        system="s", user="u", model="m", temperature=0.0, max_tokens=64
    )
    assert result.stubbed is True
    assert result.error is None
    assert "OFFLINE STUB" in result.text


def test_offline_stub_does_not_trip_the_security_rule() -> None:
    """Regression: the stub once contained 'API_KEY' and failed its own check."""
    config = load_config()
    client = GroqClient(api_key="")
    text = client.complete(system="s", user="u", model="m", temperature=0.0, max_tokens=64).text
    assert not [kw for kw in config.rules.forbidden_keywords if kw.lower() in text.lower()]


def test_pipeline_runs_every_phase_offline(tmp_path: Path) -> None:
    pipeline = EvaluationPipeline(
        retriever=StubRetriever(),
        client=GroqClient(api_key=""),
        judge=StubJudge(),
        review_store=HumanReviewStore(tmp_path / "reviews.json"),
    )
    records = pipeline.run(load_test_cases()[:3])

    assert len(records) == 3
    assert all(record.chunks for record in records)
    assert all(len(record.rules.checks) == 17 for record in records)
    assert all(record.judge.skipped_reason == "stubbed in tests" for record in records)


def test_human_review_store_round_trip(tmp_path: Path) -> None:
    store = HumanReviewStore(tmp_path / "reviews.json")
    assert store.load() == []

    store.save(new_review(case_id="TC-001", reviewer="jo", correctness=4, clarity=5))
    assert len(store.load()) == 1

    # Re-scoring the same case by the same reviewer replaces rather than appends.
    store.save(new_review(case_id="TC-001", reviewer="jo", correctness=2, clarity=3))
    reviews = store.load()
    assert len(reviews) == 1
    assert reviews[0].correctness == 2

    store.save(new_review(case_id="TC-001", reviewer="sam", correctness=5, clarity=5))
    assert len(store.load()) == 2
    assert store.latest_by_case()["TC-001"].reviewer == "sam"


def test_review_scores_are_validated() -> None:
    with pytest.raises(Exception):
        new_review(case_id="TC-001", reviewer="jo", correctness=0, clarity=3)


def test_generation_is_immutable() -> None:
    generation = Generation(answer="a", model="m", latency_ms=1.0)
    with pytest.raises(Exception):
        generation.answer = "changed"  # type: ignore[misc]


@pytest.fixture(scope="module")
def client() -> TestClient:
    from eval_poc.api import app

    return TestClient(app)


def test_health_endpoint(client: TestClient) -> None:
    body = client.get("/api/health").json()
    assert body["status"] == "ok"
    assert "groq_configured" in body


def test_knowledge_and_case_endpoints(client: TestClient) -> None:
    knowledge = client.get("/api/knowledge").json()
    assert knowledge["count"] == len(knowledge["documents"])

    cases = client.get("/api/test-cases").json()
    assert cases["count"] == len(cases["cases"])


def test_review_endpoint_rejects_unknown_case(client: TestClient) -> None:
    response = client.post(
        "/api/reviews",
        json={"case_id": "NOPE", "reviewer": "jo", "correctness": 3, "clarity": 3},
    )
    assert response.status_code == 400


def test_review_endpoint_rejects_out_of_range_score(client: TestClient) -> None:
    response = client.post(
        "/api/reviews",
        json={"case_id": "TC-001", "reviewer": "jo", "correctness": 9, "clarity": 3},
    )
    assert response.status_code == 422


class FlakyClient:
    """Fails with a transient error N times, then succeeds."""

    def __init__(self, failures: int, error_name: str = "APIConnectionError"):
        self.remaining = failures
        self.attempts = 0
        self._error = type(error_name, (Exception,), {})

    def create(self, **kwargs):
        self.attempts += 1
        if self.remaining > 0:
            self.remaining -= 1
            raise self._error("Connection error.")

        class Message:
            content = "recovered answer"

        class Choice:
            message = Message()

        class Response:
            choices = [Choice()]
            usage = None

        return Response()


def _client_with(stub: FlakyClient) -> GroqClient:
    client = GroqClient(api_key="test-key")
    client._client = type("Stub", (), {"chat": type("C", (), {"completions": stub})()})()
    return client


def test_transient_errors_are_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    """A dropped connection mid-demo must not surface as an empty answer."""
    monkeypatch.setattr("eval_poc.llm.groq_client.time.sleep", lambda _: None)
    stub = FlakyClient(failures=2)
    result = _client_with(stub).complete(
        system="s", user="u", model="m", temperature=0.0, max_tokens=64
    )
    assert stub.attempts == 3
    assert result.error is None
    assert result.text == "recovered answer"


def test_retries_give_up_and_report_the_error(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("eval_poc.llm.groq_client.time.sleep", lambda _: None)
    stub = FlakyClient(failures=99)
    result = _client_with(stub).complete(
        system="s", user="u", model="m", temperature=0.0, max_tokens=64
    )
    assert stub.attempts == 3
    assert result.error is not None and "APIConnectionError" in result.error
    assert result.text == ""


def test_non_transient_errors_are_not_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("eval_poc.llm.groq_client.time.sleep", lambda _: None)
    stub = FlakyClient(failures=99, error_name="AuthenticationError")
    result = _client_with(stub).complete(
        system="s", user="u", model="m", temperature=0.0, max_tokens=64
    )
    assert stub.attempts == 1, "a bad key must fail fast, not retry"
    assert "AuthenticationError" in (result.error or "")
