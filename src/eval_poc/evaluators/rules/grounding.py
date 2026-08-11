"""Grounding gates: is the answer traceable to the evidence it was given?

These are the cheapest hallucination detectors available — no judge model, no
API call, just set membership against the retrieved context.
"""

from __future__ import annotations

from eval_poc.models import RuleCheck, RuleGroup

from .context import CITATION_RE, NUMBER_RE, URL_RE, RuleContext, make_check, normalise_number

GROUP = RuleGroup.GROUNDING

# Numbers that carry no policy meaning and appear constantly in prose.
IGNORED_NUMBERS = frozenset({"1", "2", "3", "0"})


def _cited_ids(context: RuleContext) -> list[str]:
    return sorted({match.upper() for match in CITATION_RE.findall(context.answer)})


def check_citation_present(context: RuleContext) -> RuleCheck:
    if not context.chunks:
        return make_check(
            "citation_present", True, "no context retrieved, so no citation expected",
            group=GROUP,
            explanation="Every grounded answer must name the articles it used.",
        )
    cited = _cited_ids(context)
    return make_check(
        "citation_present", bool(cited),
        f"cited {', '.join(cited)}" if cited else "no KB citation in the answer",
        group=GROUP,
        explanation="Every grounded answer must name the articles it used.",
    )


def check_citations_exist(context: RuleContext, known_ids: frozenset[str]) -> RuleCheck:
    cited = _cited_ids(context)
    unknown = [ref for ref in cited if ref not in known_ids]
    return make_check(
        "citations_exist", not unknown,
        "all cited articles exist" if not unknown else f"cited non-existent: {', '.join(unknown)}",
        group=GROUP,
        explanation="Catches a fabricated citation to an article that is not in the knowledge base.",
    )


def check_citations_were_retrieved(context: RuleContext) -> RuleCheck:
    """The strongest cheap check: cited but never retrieved means invented."""
    cited = _cited_ids(context)
    if not cited:
        return make_check(
            "citations_were_retrieved", True, "nothing cited",
            group=GROUP,
            explanation="An article the model never received cannot honestly be cited.",
        )
    unseen = [ref for ref in cited if ref not in context.retrieved_ids]
    return make_check(
        "citations_were_retrieved", not unseen,
        "every citation was in the retrieved context"
        if not unseen
        else f"cited without retrieving: {', '.join(unseen)}",
        group=GROUP,
        explanation="An article the model never received cannot honestly be cited.",
    )


def check_numeric_grounding(context: RuleContext) -> RuleCheck:
    """Policy answers live on numbers: 90 days, 14 characters, 4 hours."""
    if not context.chunks:
        return make_check(
            "numeric_grounding", True, "no context to check numbers against",
            group=GROUP,
            explanation="Durations, limits, and thresholds must appear in the source article.",
        )

    # Strip citations first: "Sources: KB-002" would otherwise read as the
    # ungrounded figure 002.
    answer_text = CITATION_RE.sub(" ", context.answer)
    source = {normalise_number(value) for value in NUMBER_RE.findall(context.context_text)}
    answer_numbers = {normalise_number(value) for value in NUMBER_RE.findall(answer_text)}
    invented = sorted(answer_numbers - source - IGNORED_NUMBERS)
    return make_check(
        "numeric_grounding", not invented,
        "every figure appears in the source"
        if not invented
        else f"figures not in any source article: {', '.join(invented)}",
        group=GROUP,
        explanation="Durations, limits, and thresholds must appear in the source article.",
    )


def check_no_invented_links(context: RuleContext) -> RuleCheck:
    source = context.context_text.lower()
    invented = sorted(
        {
            match.lower().rstrip('.,')
            for match in URL_RE.findall(context.answer)
            if match.lower().rstrip('.,') not in source
        }
    )
    return make_check(
        "no_invented_links", not invented,
        "no invented links" if not invented else f"links not in source: {', '.join(invented)}",
        group=GROUP,
        explanation="Blocks made-up portals and domains, a common and costly hallucination.",
    )


def build_checks(known_ids: frozenset[str]):
    """Citation existence needs the corpus, so the check set is built per run."""
    return (
        check_citation_present,
        lambda context: check_citations_exist(context, known_ids),
        check_citations_were_retrieved,
        check_numeric_grounding,
        check_no_invented_links,
    )
