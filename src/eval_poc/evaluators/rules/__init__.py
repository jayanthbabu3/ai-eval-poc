"""Phase 3: the deterministic rule engine.

Seventeen independent gates across four groups. Every check runs on every
answer — one failure never short-circuits the rest, because a demo (and an
incident review) needs the full picture, not the first problem found.
"""

from __future__ import annotations

from functools import lru_cache

from eval_poc.config import RulesConfig
from eval_poc.models import (
    Generation,
    RetrievedChunk,
    RuleCheck,
    RuleGroup,
    RuleReport,
    TestCase,
)

from . import grounding, quality, security
from .context import RuleContext, make_check

__all__ = [
    "RuleContext",
    "RuleGroup",
    "evaluate_rules",
    "make_check",
    "rule_catalogue",
]


@lru_cache(maxsize=1)
def _known_document_ids() -> frozenset[str]:
    from eval_poc.knowledge.json_store import load_documents

    return frozenset(document.id for document in load_documents())


def evaluate_rules(
    generation: Generation,
    config: RulesConfig,
    *,
    question: str = "",
    chunks: list[RetrievedChunk] | None = None,
    case: TestCase | None = None,
) -> RuleReport:
    context = RuleContext(
        question=question or (case.question if case else ""),
        generation=generation,
        chunks=tuple(chunks or []),
        config=config,
        case=case,
    )

    checks: list[RuleCheck] = []
    for check in security.CHECKS:
        checks.append(check(context))
    for check in grounding.build_checks(_known_document_ids()):
        checks.append(check(context))
    for check in quality.CHECKS:
        checks.append(check(context))
    return RuleReport(checks=checks)


def rule_catalogue() -> list[dict]:
    """Static description of every gate, for the UI to render before a run."""
    blank = Generation(answer="placeholder answer for catalogue generation only", model="", latency_ms=0.0)
    report = evaluate_rules(blank, _catalogue_config())
    return [
        {
            "name": check.name,
            "group": check.group.value,
            "explanation": check.explanation,
            "is_security": check.is_security,
        }
        for check in report.checks
    ]


def _catalogue_config() -> RulesConfig:
    from eval_poc.config import load_config

    return load_config().rules
