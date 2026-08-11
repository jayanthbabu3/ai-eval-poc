"""Tests for the live assistant session: ask, then evaluate step by step."""

from __future__ import annotations

from pathlib import Path

import pytest

from eval_poc.assistant_service import AssistantService, TurnNotFoundError
from eval_poc.config import load_config
from eval_poc.evaluators.human import HumanReviewStore, new_review
from eval_poc.evaluators.llm_judge import COMPLETENESS, CORRECTNESS, DeepEvalJudge
from eval_poc.llm.groq_client import ChatResult
from eval_poc.models import JudgeReport, JudgeScore, RetrievedChunk
from eval_poc.session import TranscriptStore

ANSWER = (
    "Reset your password at password.company.internal. Passwords expire every 90 days "
    "and must be at least 14 characters. Sources: KB-002."
)


class StubRetriever:
    def search(self, query: str, top_k: int) -> list[RetrievedChunk]:
        return [
            RetrievedChunk(
                document_id="KB-002",
                title="Password reset self-service",
                content=(
                    "Reset your corporate password at password.company.internal. Passwords "
                    "expire every 90 days and must be at least 14 characters."
                ),
                score=0.6,
            ),
            RetrievedChunk(document_id="KB-011", title="Phishing", content="Report it.", score=0.01),
        ][:top_k]


class StubClient:
    available = True

    def complete(self, **kwargs) -> ChatResult:
        return ChatResult(
            text=ANSWER, latency_ms=123.0, prompt_tokens=200, completion_tokens=60, stubbed=False
        )


class StubJudge(DeepEvalJudge):
    def __init__(self) -> None:  # noqa: D107 - bypasses the real constructor
        self.calls: list[str | None] = []

    def evaluate(self, case, generation, chunks, *, question=None, expected_answer=None):
        self.calls.append(expected_answer)
        reference_free = not (expected_answer and expected_answer.strip())
        scores = [
            JudgeScore(metric=name, score=0.9, threshold=0.7, reason="stub")
            for name in (["faithfulness", "relevancy"] if reference_free else
                         ["correctness", "completeness", "faithfulness", "relevancy"])
        ]
        unscorable = (
            {CORRECTNESS: "needs a reference answer", COMPLETENESS: "needs a reference answer"}
            if reference_free
            else {}
        )
        return JudgeReport(scores=scores, unscorable=unscorable)


@pytest.fixture
def service(tmp_path: Path) -> AssistantService:
    return AssistantService(
        config=load_config(),
        retriever=StubRetriever(),
        client=StubClient(),
        judge=StubJudge(),
        store=TranscriptStore(tmp_path / "transcript.json"),
        reviews=HumanReviewStore(tmp_path / "reviews.json"),
    )


def test_ask_records_a_turn_with_a_retrieval_trace(service: AssistantService) -> None:
    turn = service.ask("How do I reset my password?")

    assert turn.id.startswith("T-")
    assert turn.generation.answer == ANSWER
    assert turn.retrieval.kept[0].document_id == "KB-002"
    assert turn.prompt_chars > 0
    # The trace keeps low scorers so the UI can show what was considered.
    assert len(turn.retrieval.candidates) >= len(turn.retrieval.kept)


def test_turn_is_pending_until_evaluated(service: AssistantService) -> None:
    turn = service.ask("How do I reset my password?")
    assert turn.verdict == "pending"
    assert turn.rules is None and turn.judge is None


def test_rules_step_populates_checks(service: AssistantService) -> None:
    turn = service.ask("How do I reset my password?")
    evaluated = service.run_rules(turn.id)

    assert evaluated.rules is not None
    assert len(evaluated.rules.checks) == 17
    # Only one method has run, so the score is partial and says so.
    assert evaluated.score.methods_run == 1
    assert evaluated.score.is_complete is False
    assert "1 of 3 methods" in evaluated.score.completeness_label


def test_judge_step_scores_all_four_with_ground_truth(service: AssistantService) -> None:
    turn = service.ask("How do I reset my password?", expected_answer="Reset at the portal.")
    service.run_rules(turn.id)
    judged = service.run_judge(turn.id)

    assert judged.judge is not None
    assert len(judged.judge.scores) == 4
    assert judged.judge.unscorable == {}


def test_judge_reports_two_metrics_as_unscorable_without_ground_truth(
    service: AssistantService,
) -> None:
    """A freely typed question has no reference, so correctness cannot be faked."""
    turn = service.ask("Some question a user typed themselves")
    service.run_rules(turn.id)
    judged = service.run_judge(turn.id)

    metrics = {score.metric for score in judged.judge.scores}
    assert metrics == {"faithfulness", "relevancy"}
    assert set(judged.judge.unscorable) == {CORRECTNESS, COMPLETENESS}


def test_human_review_attaches_to_the_turn(service: AssistantService) -> None:
    turn = service.ask("How do I reset my password?")
    review = new_review(case_id=turn.id, reviewer="jo", correctness=4, clarity=5)
    updated = service.save_human_review(turn.id, review)

    assert updated.human is not None
    assert updated.human.correctness == 4


def test_transcript_accumulates_and_updates_in_place(service: AssistantService) -> None:
    first = service.ask("How do I reset my password?")
    service.ask("What is the mailbox quota?")
    service.run_rules(first.id)

    transcript = service.transcript()
    assert len(transcript) == 2
    stored_first = next(turn for turn in transcript if turn.id == first.id)
    assert stored_first.rules is not None, "evaluating must update, not duplicate, the turn"


def test_unknown_turn_id_raises(service: AssistantService) -> None:
    with pytest.raises(TurnNotFoundError):
        service.run_rules("T-nope")


def test_clear_empties_the_transcript(service: AssistantService) -> None:
    service.ask("How do I reset my password?")
    service.clear()
    assert service.transcript() == []
