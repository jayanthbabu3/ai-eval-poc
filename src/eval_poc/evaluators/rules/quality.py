"""Format and performance gates: is the answer usable, and did it arrive in time?"""

from __future__ import annotations

import re
from collections import Counter

from eval_poc.models import RuleCheck, RuleGroup

from .context import RuleContext, make_check

FORMAT = RuleGroup.FORMAT
PERFORMANCE = RuleGroup.PERFORMANCE

HEDGING_PHRASES: tuple[str, ...] = (
    "i think", "i believe", "probably", "maybe", "might be", "not sure",
    "i guess", "as far as i know", "it seems", "possibly",
)

SENTENCE_RE = re.compile(r"[.!?]+\s")


def check_length(context: RuleContext) -> RuleCheck:
    config = context.config
    length = len(context.answer)
    return make_check(
        "response_length",
        config.min_length_chars <= length <= config.max_length_chars,
        f"{length} chars (allowed {config.min_length_chars}-{config.max_length_chars})",
        group=FORMAT,
        explanation="Too short is unhelpful; too long will not be read by an employee in a hurry.",
    )


def check_not_errored(context: RuleContext) -> RuleCheck:
    error = context.generation.error
    return make_check(
        "response_delivered", error is None and bool(context.answer.strip()),
        "answer returned successfully" if error is None else f"provider error: {error}",
        group=FORMAT,
        explanation="An empty or errored response must fail loudly rather than score zero silently.",
    )


def check_required_keywords(context: RuleContext) -> RuleCheck:
    case = context.case
    if case is None or not case.required_keywords:
        return make_check(
            "required_keywords", True, "no required keywords defined for this question",
            group=FORMAT,
            explanation="Question-specific terms that a correct answer must mention.",
        )
    missing = [kw for kw in case.required_keywords if kw.lower() not in context.lowered]
    return make_check(
        "required_keywords", not missing,
        "all present" if not missing else f"missing: {', '.join(missing)}",
        group=FORMAT,
        explanation="Question-specific terms that a correct answer must mention.",
    )


def check_no_hedging(context: RuleContext) -> RuleCheck:
    hits = sorted({phrase for phrase in HEDGING_PHRASES if phrase in context.lowered})
    return make_check(
        "no_hedging", not hits,
        "confident phrasing" if not hits else f"hedged with: {', '.join(hits)}",
        group=FORMAT,
        explanation="A policy answer that hedges pushes the decision back onto the employee.",
    )


def check_no_repetition(context: RuleContext) -> RuleCheck:
    """Catches degenerate looping output."""
    sentences = [s.strip().lower() for s in SENTENCE_RE.split(context.answer) if len(s.strip()) > 20]
    if len(sentences) < 2:
        return make_check(
            "no_repetition", True, "too short to repeat",
            group=FORMAT,
            explanation="Detects degenerate output that loops the same sentence.",
        )
    most_common, count = Counter(sentences).most_common(1)[0]
    return make_check(
        "no_repetition", count < 2,
        "no repeated sentences" if count < 2 else f"sentence repeated {count}x: {most_common[:60]}…",
        group=FORMAT,
        explanation="Detects degenerate output that loops the same sentence.",
    )


def check_latency(context: RuleContext) -> RuleCheck:
    budget = context.config.max_latency_ms
    latency = context.generation.latency_ms
    return make_check(
        "latency", latency <= budget,
        f"{latency:.0f} ms (budget {budget} ms)",
        group=PERFORMANCE,
        explanation="A service-desk answer that arrives too late gets abandoned.",
    )


def check_token_budget(context: RuleContext) -> RuleCheck:
    budget = context.config.max_completion_tokens
    used = context.generation.completion_tokens
    if used == 0:
        return make_check(
            "token_budget", True, "token usage not reported",
            group=PERFORMANCE,
            explanation="Caps the per-answer cost of running the assistant at scale.",
        )
    return make_check(
        "token_budget", used <= budget,
        f"{used} completion tokens (budget {budget})",
        group=PERFORMANCE,
        explanation="Caps the per-answer cost of running the assistant at scale.",
    )


CHECKS = (
    check_not_errored,
    check_length,
    check_required_keywords,
    check_no_hedging,
    check_no_repetition,
    check_latency,
    check_token_budget,
)
