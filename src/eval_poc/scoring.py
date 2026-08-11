"""Combines the three evaluation methods into one score, honestly.

Two rules drive the design:

1. A method that has not run is *absent*, not zero. Scoring an un-reviewed answer
   as 0 for "human" would make every fresh answer look terrible. Missing methods
   are excluded and the remaining weights are renormalised, with the result
   labelled so nobody mistakes a partial score for a complete one.
2. A security failure is not a deduction, it is a veto. A leaked credential is not
   redeemed by fast, well-cited prose, so any failed security rule blocks the
   release regardless of the arithmetic.
"""

from __future__ import annotations

from statistics import mean

from pydantic import BaseModel, ConfigDict

from eval_poc.models import HumanReview, JudgeReport, RuleGroup, RuleReport, RuleStatus

# Weights are deliberate: the judge carries the most because it is the only method
# that reads meaning, but deterministic checks and a human both keep it honest.
WEIGHT_RULES = 0.30
WEIGHT_JUDGE = 0.40
WEIGHT_HUMAN = 0.30

HUMAN_SCALE_MAX = 5
HUMAN_CRITERIA = ("correctness", "completeness", "clarity", "tone")

PASS_SCORE = 70.0


class MethodScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    key: str
    label: str
    score: float | None
    weight: float
    detail: str


class TurnScore(BaseModel):
    model_config = ConfigDict(frozen=True)

    methods: list[MethodScore]
    final: float | None
    methods_run: int
    methods_total: int = 3
    is_complete: bool
    completeness_label: str
    blocked: bool
    blocking_reasons: list[str]
    verdict: str


def rules_score(rules: RuleReport | None) -> tuple[float | None, str]:
    if rules is None or not rules.checks:
        return None, "not run"
    passed = sum(1 for check in rules.checks if check.status is RuleStatus.PASS)
    total = len(rules.checks)
    return round(passed / total * 100, 1), f"{passed}/{total} checks passed"


def judge_score(judge: JudgeReport | None) -> tuple[float | None, str]:
    if judge is None:
        return None, "not run"
    if judge.skipped_reason is not None:
        return None, f"skipped — {judge.skipped_reason}"
    if not judge.scores:
        return None, "no metrics scored"

    usable = [entry for entry in judge.scores if not entry.errored]
    failed = len(judge.scores) - len(usable)
    if not usable:
        return None, f"all {failed} judge call(s) failed — not scored"

    value = round(mean(entry.score for entry in usable) * 100, 1)
    detail = f"mean of {len(usable)} metric(s)"
    if failed:
        detail += f"; {failed} judge call(s) failed and were excluded"
    if judge.unscorable:
        # Say so out loud: a 2-of-4 score is not the same as a 4-of-4 score.
        detail += f"; {len(judge.unscorable)} not scorable without a reference answer"
    return value, detail


def human_score(human: HumanReview | None) -> tuple[float | None, str]:
    if human is None:
        return None, "not reviewed"
    ratings = [getattr(human, name) for name in HUMAN_CRITERIA]
    value = round(mean(ratings) / HUMAN_SCALE_MAX * 100, 1)
    detail = f"mean {mean(ratings):.2f}/{HUMAN_SCALE_MAX} across {len(ratings)} criteria"
    if human.ship_it is False:
        detail += "; reviewer would not send this to staff"
    return value, detail


def security_failures(rules: RuleReport | None) -> list[str]:
    if rules is None:
        return []
    return [
        f"{check.name}: {check.detail}"
        for check in rules.checks
        if check.group is RuleGroup.SECURITY and check.status is RuleStatus.FAIL
    ]


def score_turn(
    rules: RuleReport | None,
    judge: JudgeReport | None,
    human: HumanReview | None,
) -> TurnScore:
    rules_value, rules_detail = rules_score(rules)
    judge_value, judge_detail = judge_score(judge)
    human_value, human_detail = human_score(human)

    methods = [
        MethodScore(
            key="rules",
            label="Rule checks (automated)",
            score=rules_value,
            weight=WEIGHT_RULES,
            detail=rules_detail,
        ),
        MethodScore(
            key="judge",
            label="LLM judge (AI)",
            score=judge_value,
            weight=WEIGHT_JUDGE,
            detail=judge_detail,
        ),
        MethodScore(
            key="human",
            label="Human review (manual)",
            score=human_value,
            weight=WEIGHT_HUMAN,
            detail=human_detail,
        ),
    ]

    present = [method for method in methods if method.score is not None]
    weight_total = sum(method.weight for method in present)
    final = (
        round(sum(m.score * m.weight for m in present) / weight_total, 1)  # type: ignore[operator]
        if present and weight_total > 0
        else None
    )

    blocking = security_failures(rules)
    is_complete = len(present) == len(methods)
    label = (
        "all three methods"
        if is_complete
        else f"{len(present)} of 3 methods — weights renormalised"
        if present
        else "not evaluated yet"
    )

    if blocking:
        verdict = "blocked"
    elif final is None:
        verdict = "pending"
    elif final >= PASS_SCORE:
        verdict = "pass"
    else:
        verdict = "fail"

    return TurnScore(
        methods=methods,
        final=final,
        methods_run=len(present),
        is_complete=is_complete,
        completeness_label=label,
        blocked=bool(blocking),
        blocking_reasons=blocking,
        verdict=verdict,
    )


class SuiteScore(BaseModel):
    """Aggregate across every question asked in a session."""

    model_config = ConfigDict(frozen=True)

    turns: int
    evaluated_turns: int
    avg_rules: float | None
    avg_judge: float | None
    avg_human: float | None
    final: float | None
    passed: int
    failed: int
    blocked: int
    pending: int
    security_failures: int


def score_suite(turn_scores: list[TurnScore]) -> SuiteScore:
    def average(key: str) -> float | None:
        values = [
            method.score
            for score in turn_scores
            for method in score.methods
            if method.key == key and method.score is not None
        ]
        return round(mean(values), 1) if values else None

    finals = [score.final for score in turn_scores if score.final is not None]

    return SuiteScore(
        turns=len(turn_scores),
        evaluated_turns=len(finals),
        avg_rules=average("rules"),
        avg_judge=average("judge"),
        avg_human=average("human"),
        final=round(mean(finals), 1) if finals else None,
        passed=sum(1 for score in turn_scores if score.verdict == "pass"),
        failed=sum(1 for score in turn_scores if score.verdict == "fail"),
        blocked=sum(1 for score in turn_scores if score.verdict == "blocked"),
        pending=sum(1 for score in turn_scores if score.verdict == "pending"),
        security_failures=sum(len(score.blocking_reasons) for score in turn_scores),
    )
