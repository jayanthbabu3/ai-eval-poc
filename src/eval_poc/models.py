"""Immutable schemas shared by every evaluation phase."""

from __future__ import annotations

from enum import StrEnum

from pydantic import BaseModel, ConfigDict, Field


class Frozen(BaseModel):
    """Base model: frozen instances force copy-on-write updates."""

    model_config = ConfigDict(frozen=True)


class Document(Frozen):
    id: str
    title: str
    category: str
    tags: list[str] = Field(default_factory=list)
    content: str


class RetrievedChunk(Frozen):
    document_id: str
    title: str
    content: str
    score: float


class TestCase(Frozen):
    id: str
    question: str
    expected_answer: str
    required_keywords: list[str] = Field(default_factory=list)
    category: str
    difficulty: str


class Generation(Frozen):
    answer: str
    model: str
    latency_ms: float
    prompt_tokens: int = 0
    completion_tokens: int = 0
    stubbed: bool = False
    error: str | None = None


class RuleStatus(StrEnum):
    PASS = "pass"
    FAIL = "fail"


class RuleGroup(StrEnum):
    SECURITY = "security"
    GROUNDING = "grounding"
    FORMAT = "format"
    PERFORMANCE = "performance"


class RuleCheck(Frozen):
    name: str
    status: RuleStatus
    detail: str
    group: RuleGroup = RuleGroup.FORMAT
    is_security: bool = False
    # Shown in the UI so a demo audience learns what each gate is for.
    explanation: str = ""


class RuleReport(Frozen):
    checks: list[RuleCheck]

    def by_group(self, group: RuleGroup) -> list[RuleCheck]:
        return [check for check in self.checks if check.group is group]

    @property
    def passed(self) -> bool:
        return all(check.status is RuleStatus.PASS for check in self.checks)

    @property
    def security_violations(self) -> int:
        return sum(
            1
            for check in self.checks
            if check.is_security and check.status is RuleStatus.FAIL
        )


class JudgeScore(Frozen):
    metric: str
    score: float = Field(ge=0.0, le=1.0)
    threshold: float
    reason: str
    # Set when the judge call itself failed (rate limit, network, bad JSON).
    # An infrastructure failure must never be read as "the answer scored zero".
    error: str | None = None

    @property
    def errored(self) -> bool:
        return self.error is not None

    @property
    def passed(self) -> bool:
        return not self.errored and self.score >= self.threshold


class JudgeCallTrace(Frozen):
    """The verbatim exchange with the judge model, captured for inspection."""

    metric: str
    stage: str
    system_prompt: str
    prompt: str
    raw_response: str
    latency_ms: float


class JudgeReport(Frozen):
    scores: list[JudgeScore] = Field(default_factory=list)
    skipped_reason: str | None = None
    traces: list[JudgeCallTrace] = Field(default_factory=list)
    # Metrics that cannot be scored for this answer, and why. Correctness and
    # completeness compare against a known-good answer, so a freely typed
    # question leaves them unscorable — reported openly, never faked as 0.
    unscorable: dict[str, str] = Field(default_factory=dict)

    def score_for(self, metric: str) -> float | None:
        for entry in self.scores:
            if entry.metric == metric:
                return entry.score
        return None

    @property
    def passed(self) -> bool:
        return bool(self.scores) and all(entry.passed for entry in self.scores)


class HumanReview(Frozen):
    case_id: str
    reviewer: str
    correctness: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    # Defaults keep reviews written before the rubric expanded loadable.
    completeness: int = Field(default=3, ge=1, le=5)
    tone: int = Field(default=3, ge=1, le=5)
    ship_it: bool = True
    comment: str = ""
    reviewed_at: str


class EvalRecord(Frozen):
    case: TestCase
    chunks: list[RetrievedChunk]
    generation: Generation
    rules: RuleReport
    judge: JudgeReport
    human: HumanReview | None = None

    @property
    def overall_passed(self) -> bool:
        """A case passes only if rules pass and, when judged, the judge passes."""
        if not self.rules.passed:
            return False
        if self.judge.skipped_reason is not None:
            return True
        return self.judge.passed
