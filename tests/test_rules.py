"""Phase 3 tests: the deterministic rule engine."""

from __future__ import annotations

import pytest

from eval_poc.config import RulesConfig
from eval_poc.evaluators.rules import evaluate_rules
from eval_poc.models import Generation, RetrievedChunk, RuleStatus, TestCase

RULES = RulesConfig(
    min_length_chars=40,
    max_length_chars=200,
    max_latency_ms=5000,
    forbidden_keywords=["api key", "password is"],
    max_completion_tokens=400,
)

CASE = TestCase(
    id="TC-X",
    question="How do I reset my password?",
    expected_answer="Use the self-service portal.",
    required_keywords=["portal"],
    category="Identity",
    difficulty="easy",
)


# Rules that inspect evidence (grounding, deferral) need retrieved context,
# so every fixture supplies a chunk the way a real turn would.
CHUNKS = [
    RetrievedChunk(
        document_id="KB-002",
        title="Password reset self-service",
        content=(
            "Reset your corporate password at the self-service portal. You must have MFA "
            "enrolled. Passwords expire every 90 days and must be at least 14 characters."
        ),
        score=0.6,
    )
]


def make_generation(answer: str, latency_ms: float = 100.0) -> Generation:
    return Generation(answer=answer, model="test", latency_ms=latency_ms)


def status_of(report, name: str) -> RuleStatus:
    return next(check.status for check in report.checks if check.name == name)


def test_clean_answer_passes_every_check() -> None:
    answer = "Reset it yourself at the self-service portal after enrolling in MFA first. Sources: KB-002."
    report = evaluate_rules(make_generation(answer), RULES, chunks=CHUNKS, case=CASE)
    assert report.passed
    assert report.security_violations == 0


def test_short_answer_fails_length() -> None:
    report = evaluate_rules(make_generation("Use the portal."), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "response_length") is RuleStatus.FAIL
    assert not report.passed


def test_overlong_answer_fails_length() -> None:
    report = evaluate_rules(make_generation("portal " * 60), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "response_length") is RuleStatus.FAIL


def test_forbidden_keyword_is_a_security_violation() -> None:
    answer = "Sure, the admin password is hunter2 and you can use it on the portal now."
    report = evaluate_rules(make_generation(answer), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "forbidden_terms") is RuleStatus.FAIL
    assert report.security_violations == 1


def test_forbidden_keyword_match_is_case_insensitive() -> None:
    answer = "Here is the API KEY you asked for, use it at the self-service portal today."
    report = evaluate_rules(make_generation(answer), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "forbidden_terms") is RuleStatus.FAIL


def test_missing_required_keyword_fails() -> None:
    answer = "Contact the service desk and they will sort the whole thing out for you."
    report = evaluate_rules(make_generation(answer), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "required_keywords") is RuleStatus.FAIL


def test_case_without_required_keywords_passes_that_check() -> None:
    case = TestCase(
        id="TC-Y",
        question="anything",
        expected_answer="anything",
        required_keywords=[],
        category="Other",
        difficulty="easy",
    )
    answer = "This answer is long enough to satisfy the configured minimum length rule."
    report = evaluate_rules(make_generation(answer), RULES, chunks=CHUNKS, case=case)
    assert status_of(report, "required_keywords") is RuleStatus.PASS


@pytest.mark.parametrize(("latency", "expected"), [(4999.0, RuleStatus.PASS), (5001.0, RuleStatus.FAIL)])
def test_latency_budget_boundary(latency: float, expected: RuleStatus) -> None:
    answer = "Reset it yourself at the self-service portal after enrolling in MFA first. Sources: KB-002."
    report = evaluate_rules(make_generation(answer, latency), RULES, chunks=CHUNKS, case=CASE)
    assert status_of(report, "latency") is expected


def test_all_checks_run_even_when_one_fails() -> None:
    """One failure must not mask the others — every gate reports independently."""
    report = evaluate_rules(make_generation("no", 9999.0), RULES, chunks=CHUNKS, case=CASE)
    names = {check.name for check in report.checks}
    assert len(report.checks) == 17
    assert {"response_length", "forbidden_terms", "required_keywords", "latency"} <= names
