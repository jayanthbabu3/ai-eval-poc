"""Tests for the combined score: weighting, renormalisation, and the security gate."""

from __future__ import annotations

import pytest

from eval_poc.assistants.registry import (
    DEFAULT_VERSION_ID,
    UnknownVersionError,
    get_version,
    list_versions,
)
from eval_poc.evaluators.human import HUMAN_RUBRIC, new_review, rubric_payload
from eval_poc.models import (
    JudgeReport,
    JudgeScore,
    RuleCheck,
    RuleGroup,
    RuleReport,
    RuleStatus,
)
from eval_poc.scoring import (
    PASS_SCORE,
    WEIGHT_HUMAN,
    WEIGHT_JUDGE,
    WEIGHT_RULES,
    score_suite,
    score_turn,
)


def rules(passed: int, total: int = 10, *, security_fail: bool = False) -> RuleReport:
    checks = [
        RuleCheck(
            name=f"check_{index}",
            status=RuleStatus.PASS if index < passed else RuleStatus.FAIL,
            detail="d",
            group=RuleGroup.FORMAT,
        )
        for index in range(total)
    ]
    if security_fail:
        checks.append(
            RuleCheck(
                name="forbidden_terms",
                status=RuleStatus.FAIL,
                detail="disclosed a credential",
                group=RuleGroup.SECURITY,
                is_security=True,
            )
        )
    return RuleReport(checks=checks)


def judge(*scores: float, unscorable: dict | None = None) -> JudgeReport:
    return JudgeReport(
        scores=[
            JudgeScore(metric=f"m{i}", score=value, threshold=0.7, reason="r")
            for i, value in enumerate(scores)
        ],
        unscorable=unscorable or {},
    )


def human(**kwargs) -> object:
    defaults = {"correctness": 4, "completeness": 4, "clarity": 4, "tone": 4}
    return new_review(case_id="T-1", reviewer="jo", **{**defaults, **kwargs})


# --- component scores -------------------------------------------------------


def test_each_method_normalises_to_100() -> None:
    score = score_turn(rules(8, 10), judge(0.8, 0.6), human())
    by_key = {method.key: method.score for method in score.methods}
    assert by_key["rules"] == 80.0
    assert by_key["judge"] == 70.0
    assert by_key["human"] == 80.0


def test_final_is_the_weighted_sum_when_all_three_ran() -> None:
    score = score_turn(rules(8, 10), judge(0.8, 0.6), human())
    expected = 80 * WEIGHT_RULES + 70 * WEIGHT_JUDGE + 80 * WEIGHT_HUMAN
    assert score.final == pytest.approx(expected, abs=0.05)
    assert score.is_complete is True
    assert score.methods_run == 3


def test_missing_method_is_excluded_not_zero() -> None:
    """A method that has not run must never be counted as a zero."""
    score = score_turn(rules(10, 10), judge(1.0), None)
    # Both present methods scored 100, so the final must be 100 — not 70.
    assert score.final == 100.0
    assert score.methods_run == 2
    assert score.is_complete is False
    assert "2 of 3 methods" in score.completeness_label


def test_weights_renormalise_over_present_methods() -> None:
    score = score_turn(rules(10, 10), judge(0.5), None)
    expected = (100 * WEIGHT_RULES + 50 * WEIGHT_JUDGE) / (WEIGHT_RULES + WEIGHT_JUDGE)
    assert score.final == pytest.approx(expected, abs=0.05)


def test_nothing_evaluated_yields_pending() -> None:
    score = score_turn(None, None, None)
    assert score.final is None
    assert score.verdict == "pending"
    assert score.completeness_label == "not evaluated yet"


# --- security gate ----------------------------------------------------------


def test_security_failure_blocks_regardless_of_score() -> None:
    """A perfect score must not buy its way past a leaked credential."""
    score = score_turn(rules(10, 10, security_fail=True), judge(1.0), human(correctness=5))
    assert score.final is not None and score.final > PASS_SCORE
    assert score.blocked is True
    assert score.verdict == "blocked"
    assert any("forbidden_terms" in reason for reason in score.blocking_reasons)


def test_non_security_failure_does_not_block() -> None:
    score = score_turn(rules(5, 10), judge(1.0), human())
    assert score.blocked is False
    assert score.verdict in {"pass", "fail"}


def test_pass_threshold_boundary() -> None:
    assert score_turn(rules(10, 10), judge(0.7), human(correctness=4)).verdict == "pass"
    assert score_turn(rules(2, 10), judge(0.2), human(correctness=1, completeness=1,
                                                      clarity=1, tone=1)).verdict == "fail"


# --- judge honesty ----------------------------------------------------------


def test_unscorable_metrics_are_flagged_not_averaged_in() -> None:
    score = score_turn(None, judge(1.0, 1.0, unscorable={"correctness": "no reference"}), None)
    judge_method = next(m for m in score.methods if m.key == "judge")
    assert judge_method.score == 100.0
    assert "not scorable" in judge_method.detail


def test_skipped_judge_is_absent_not_zero() -> None:
    score = score_turn(rules(10, 10), JudgeReport(skipped_reason="no credential"), None)
    judge_method = next(m for m in score.methods if m.key == "judge")
    assert judge_method.score is None
    assert score.final == 100.0


# --- human rubric -----------------------------------------------------------


def test_human_score_averages_the_four_scored_criteria() -> None:
    score = score_turn(None, None, human(correctness=5, completeness=4, clarity=3, tone=2))
    human_method = next(m for m in score.methods if m.key == "human")
    assert human_method.score == 70.0  # mean 3.5 of 5


def test_ship_it_is_recorded_but_not_averaged() -> None:
    with_ship = score_turn(None, None, human(ship_it=True))
    without_ship = score_turn(None, None, human(ship_it=False))
    assert with_ship.final == without_ship.final
    detail = next(m for m in without_ship.methods if m.key == "human").detail
    assert "would not send" in detail


def test_rubric_payload_matches_the_scored_criteria() -> None:
    payload = rubric_payload()
    assert payload["scale_max"] == 5
    assert len(payload["items"]) == len(HUMAN_RUBRIC) == 5
    assert payload["scored_criteria"] == ["correctness", "completeness", "clarity", "tone"]
    assert all(item["question"] for item in payload["items"])


# --- suite aggregate --------------------------------------------------------


def test_suite_aggregates_verdicts_and_averages() -> None:
    suite = score_suite(
        [
            score_turn(rules(10, 10), judge(1.0), human(correctness=5, completeness=5,
                                                        clarity=5, tone=5)),
            score_turn(rules(3, 10), judge(0.2), human(correctness=1, completeness=1,
                                                       clarity=1, tone=1)),
            score_turn(rules(10, 10, security_fail=True), judge(1.0), human()),
            score_turn(None, None, None),
        ]
    )
    assert suite.turns == 4
    assert suite.passed == 1
    assert suite.failed == 1
    assert suite.blocked == 1
    assert suite.pending == 1
    assert suite.security_failures == 1
    assert suite.final is not None


def test_empty_suite_does_not_divide_by_zero() -> None:
    suite = score_suite([])
    assert suite.turns == 0
    assert suite.final is None


# --- assistant versions -----------------------------------------------------


def test_two_versions_exist_and_differ_meaningfully() -> None:
    versions = list_versions()
    assert len(versions) == 2

    v1, v2 = get_version("v1"), get_version("v2")
    assert v1.top_k < v2.top_k
    assert len(v1.system_prompt) < len(v2.system_prompt)
    # V1 must genuinely lack the instructions V2 has, or the comparison is theatre.
    for instruction in ("Sources:", "Never reveal", "Answer only from"):
        assert instruction in v2.system_prompt
        assert instruction not in v1.system_prompt


def test_default_version_is_the_hardened_one() -> None:
    assert get_version(None).id == DEFAULT_VERSION_ID == "v2"


def test_unknown_version_raises() -> None:
    with pytest.raises(UnknownVersionError):
        get_version("v99")


# --- judge infrastructure failures ------------------------------------------


def errored_judge(*, failed: int, ok: list[float]) -> JudgeReport:
    scores = [
        JudgeScore(
            metric=f"failed_{i}",
            score=0.0,
            threshold=0.7,
            reason="the judge could not be reached: RateLimitError",
            error="RateLimitError: 429",
        )
        for i in range(failed)
    ] + [
        JudgeScore(metric=f"ok_{i}", score=value, threshold=0.7, reason="r")
        for i, value in enumerate(ok)
    ]
    return JudgeReport(scores=scores)


def test_failed_judge_calls_are_excluded_not_scored_zero() -> None:
    """A rate limit is not a quality signal — it must not drag the score down."""
    score = score_turn(None, errored_judge(failed=2, ok=[1.0, 1.0]), None)
    judge_method = next(m for m in score.methods if m.key == "judge")
    assert judge_method.score == 100.0, "errored metrics must not be averaged in as zeros"
    assert "2 judge call(s) failed" in judge_method.detail


def test_all_judge_calls_failing_leaves_the_method_unscored() -> None:
    score = score_turn(rules(10, 10), errored_judge(failed=4, ok=[]), None)
    judge_method = next(m for m in score.methods if m.key == "judge")
    assert judge_method.score is None
    assert "all 4 judge call(s) failed" in judge_method.detail
    # Rules alone still produce an honest final score.
    assert score.final == 100.0
    assert score.methods_run == 1


def test_errored_score_never_counts_as_passing() -> None:
    entry = JudgeScore(metric="m", score=1.0, threshold=0.7, reason="r", error="boom")
    assert entry.errored is True
    assert entry.passed is False
