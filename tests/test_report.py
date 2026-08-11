"""Reporting tests: aggregation maths and the markdown renderer."""

from __future__ import annotations

from eval_poc.config import load_config
from eval_poc.models import (
    EvalRecord,
    Generation,
    HumanReview,
    JudgeReport,
    JudgeScore,
    RetrievedChunk,
    RuleCheck,
    RuleReport,
    RuleStatus,
    TestCase,
)
from eval_poc.report import build_run_payload, render_markdown, summarize

THRESHOLD = 0.7


def make_case(case_id: str) -> TestCase:
    return TestCase(
        id=case_id,
        question=f"question {case_id}",
        expected_answer="expected",
        required_keywords=[],
        category="Identity",
        difficulty="easy",
    )


def make_record(
    case_id: str,
    *,
    rules_pass: bool = True,
    security_fail: bool = False,
    judge_score: float | None = 0.9,
    latency_ms: float = 500.0,
    human: HumanReview | None = None,
) -> EvalRecord:
    checks = [
        RuleCheck(
            name="response_length",
            status=RuleStatus.PASS if rules_pass else RuleStatus.FAIL,
            detail="detail",
        ),
        RuleCheck(
            name="forbidden_keywords",
            status=RuleStatus.FAIL if security_fail else RuleStatus.PASS,
            detail="detail",
            is_security=True,
        ),
    ]
    judge = (
        JudgeReport(
            scores=[
                JudgeScore(metric=name, score=judge_score, threshold=THRESHOLD, reason="r")
                for name in ("correctness", "completeness", "faithfulness", "relevancy")
            ]
        )
        if judge_score is not None
        else JudgeReport(skipped_reason="judge disabled")
    )
    return EvalRecord(
        case=make_case(case_id),
        chunks=[RetrievedChunk(document_id="KB-001", title="t", content="c", score=0.5)],
        generation=Generation(answer="an answer", model="test", latency_ms=latency_ms),
        rules=RuleReport(checks=checks),
        judge=judge,
        human=human,
    )


def test_summary_counts_passes_and_failures() -> None:
    records = [
        make_record("TC-1"),
        make_record("TC-2", rules_pass=False),
        make_record("TC-3", judge_score=0.4),
    ]
    summary = summarize(records)
    assert summary.total_cases == 3
    assert summary.passed_cases == 1
    assert summary.failed_cases == 2
    assert summary.pass_rate == round(1 / 3, 4)
    assert summary.fail_rate == round(2 / 3, 4)


def test_security_violations_only_count_security_rules() -> None:
    records = [make_record("TC-1", security_fail=True), make_record("TC-2", rules_pass=False)]
    assert summarize(records).security_violations == 1


def test_rule_pass_rate_is_over_checks_not_cases() -> None:
    # 2 records x 2 checks = 4 checks, one of which fails.
    summary = summarize([make_record("TC-1"), make_record("TC-2", rules_pass=False)])
    assert summary.rule_checks_total == 4
    assert summary.rule_checks_passed == 3
    assert summary.rule_pass_rate == 0.75


def test_judge_averages_and_skips() -> None:
    records = [make_record("TC-1", judge_score=0.8), make_record("TC-2", judge_score=0.6)]
    summary = summarize(records)
    assert summary.avg_correctness == 0.7
    assert summary.judged_cases == 2

    skipped = summarize([make_record("TC-3", judge_score=None)])
    assert skipped.avg_correctness is None
    assert skipped.judged_cases == 0


def test_skipped_judge_falls_back_to_rules_for_the_verdict() -> None:
    assert summarize([make_record("TC-1", judge_score=None)]).passed_cases == 1
    assert summarize([make_record("TC-2", judge_score=None, rules_pass=False)]).passed_cases == 0


def test_latency_statistics() -> None:
    records = [make_record(f"TC-{i}", latency_ms=value) for i, value in enumerate([100, 200, 900])]
    summary = summarize(records)
    assert summary.avg_latency_ms == 400.0
    assert summary.max_latency_ms == 900.0
    assert summary.p95_latency_ms == 900.0


def test_human_scores_average_only_over_reviewed_cases() -> None:
    review = HumanReview(
        case_id="TC-1",
        reviewer="jo",
        correctness=4,
        clarity=5,
        comment="",
        reviewed_at="2026-08-11T10:00:00+00:00",
    )
    summary = summarize([make_record("TC-1", human=review), make_record("TC-2")])
    assert summary.human_reviewed_cases == 1
    assert summary.avg_human_correctness == 4.0
    assert summary.avg_human_clarity == 5.0


def test_empty_run_does_not_divide_by_zero() -> None:
    summary = summarize([])
    assert summary.total_cases == 0
    assert summary.pass_rate == 0.0
    assert summary.avg_latency_ms == 0.0


def test_markdown_report_contains_summary_and_failures() -> None:
    records = [make_record("TC-1"), make_record("TC-2", rules_pass=False)]
    markdown = render_markdown(build_run_payload(records, load_config()))
    assert "# AI Evaluation Report" in markdown
    assert "| Pass rate | 50.0% |" in markdown
    assert "TC-2" in markdown
    assert "Failure detail" in markdown
