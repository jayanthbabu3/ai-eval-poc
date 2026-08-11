"""Shared inputs and helpers for every rule check."""

from __future__ import annotations

import re
from dataclasses import dataclass

from eval_poc.config import RulesConfig
from eval_poc.models import Generation, RetrievedChunk, RuleCheck, RuleGroup, RuleStatus, TestCase


@dataclass(frozen=True)
class RuleContext:
    """Everything a rule may inspect: the ask, the answer, and its evidence."""

    question: str
    generation: Generation
    chunks: tuple[RetrievedChunk, ...]
    config: RulesConfig
    case: TestCase | None = None

    @property
    def answer(self) -> str:
        return self.generation.answer

    @property
    def lowered(self) -> str:
        return self.generation.answer.lower()

    @property
    def context_text(self) -> str:
        return " ".join(chunk.content for chunk in self.chunks)

    @property
    def retrieved_ids(self) -> frozenset[str]:
        return frozenset(chunk.document_id for chunk in self.chunks)


def make_check(
    name: str,
    ok: bool,
    detail: str,
    *,
    group: RuleGroup,
    explanation: str,
    is_security: bool = False,
) -> RuleCheck:
    return RuleCheck(
        name=name,
        status=RuleStatus.PASS if ok else RuleStatus.FAIL,
        detail=detail,
        group=group,
        is_security=is_security,
        explanation=explanation,
    )


NUMBER_RE = re.compile(r"\b\d[\d,]*(?:\.\d+)?\b")
URL_RE = re.compile(r"\b(?:https?://)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:/[^\s,)]*)?\b", re.IGNORECASE)
CITATION_RE = re.compile(r"KB-\d{3}", re.IGNORECASE)


def normalise_number(value: str) -> str:
    """'1,200' and '1200' are the same number; '4.0' and '4' are not worth splitting."""
    return value.replace(",", "").rstrip(".").lower()
