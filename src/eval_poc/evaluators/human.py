"""Phase 5: human evaluation — the rubric, and the store that keeps the answers.

The rubric is data rather than markup so the review form and the "what do we ask a
human?" modal are generated from the same definition and cannot drift apart.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from pydantic import BaseModel, ConfigDict, ValidationError

from eval_poc.config import DATA_DIR
from eval_poc.models import HumanReview

REVIEWS_PATH = DATA_DIR / "human_reviews.json"
SCALE_MAX = 5


class RubricItem(BaseModel):
    model_config = ConfigDict(frozen=True)

    id: str
    label: str
    question: str
    guidance: str
    kind: str  # "scale" or "boolean"
    scored: bool  # whether it contributes to the numeric human score


HUMAN_RUBRIC: tuple[RubricItem, ...] = (
    RubricItem(
        id="correctness",
        label="Correctness",
        question="Is the answer factually right against our written policy?",
        guidance="5 = every fact and figure matches the article. 1 = contradicts policy.",
        kind="scale",
        scored=True,
    ),
    RubricItem(
        id="completeness",
        label="Completeness",
        question="Does it cover everything the employee needs to act?",
        guidance="5 = no missing step, threshold, or approval. 1 = leaves them stuck.",
        kind="scale",
        scored=True,
    ),
    RubricItem(
        id="clarity",
        label="Clarity",
        question="Could an employee act on this without re-reading it?",
        guidance="5 = plain and unambiguous. 1 = confusing or contradictory.",
        kind="scale",
        scored=True,
    ),
    RubricItem(
        id="tone",
        label="Tone",
        question="Is the tone professional and appropriate for internal IT?",
        guidance="5 = calm, helpful, corporate. 1 = rude, casual, or alarming.",
        kind="scale",
        scored=True,
    ),
    RubricItem(
        id="ship_it",
        label="Would you send this?",
        question="Would you be comfortable sending this answer to an employee as-is?",
        guidance=(
            "The gut-check that catches answers which score well but still feel wrong. "
            "Recorded alongside the score rather than folded into it."
        ),
        kind="boolean",
        scored=False,
    ),
)


def rubric_payload() -> dict:
    return {
        "scale_max": SCALE_MAX,
        "scored_criteria": [item.id for item in HUMAN_RUBRIC if item.scored],
        "items": [item.model_dump() for item in HUMAN_RUBRIC],
        "scoring_note": (
            "The human score is the mean of the four 1-5 ratings, converted to a "
            "0-100 scale. 'Would you send this?' is recorded and shown, but is not "
            "averaged into the number."
        ),
    }


class HumanReviewStore:
    """Append-only-per-reviewer JSON store. One review per (case, reviewer)."""

    def __init__(self, path: Path = REVIEWS_PATH) -> None:
        self._path = path

    def load(self) -> list[HumanReview]:
        if not self._path.exists():
            return []
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Human reviews at {self._path} are corrupt: {error}") from error

        reviews: list[HumanReview] = []
        for item in raw.get("reviews", []):
            try:
                reviews.append(HumanReview.model_validate(item))
            except ValidationError:
                continue  # skip malformed rows rather than blocking the dashboard
        return reviews

    def latest_by_case(self) -> dict[str, HumanReview]:
        """Most recent review wins when several reviewers scored the same case."""
        ordered = sorted(self.load(), key=lambda review: review.reviewed_at)
        return {review.case_id: review for review in ordered}

    def save(self, review: HumanReview) -> list[HumanReview]:
        existing = [
            item
            for item in self.load()
            if not (item.case_id == review.case_id and item.reviewer == review.reviewer)
        ]
        updated = [*existing, review]
        self._write(updated)
        return updated

    def _write(self, reviews: list[HumanReview]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "2.0.0",
            "updated_at": datetime.now(UTC).isoformat(),
            "reviews": [review.model_dump() for review in reviews],
        }
        self._path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def new_review(
    *,
    case_id: str,
    reviewer: str,
    correctness: int,
    clarity: int,
    completeness: int = 3,
    tone: int = 3,
    ship_it: bool = True,
    comment: str = "",
) -> HumanReview:
    return HumanReview(
        case_id=case_id,
        reviewer=reviewer.strip() or "anonymous",
        correctness=correctness,
        clarity=clarity,
        completeness=completeness,
        tone=tone,
        ship_it=ship_it,
        comment=comment.strip(),
        reviewed_at=datetime.now(UTC).isoformat(),
    )
