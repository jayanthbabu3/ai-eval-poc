"""Live assistant session: every asked question is stored, then evaluated on demand.

This is the demo path. The batch pipeline still exists for the full suite; this
module is what the chat UI drives, one turn at a time.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from pydantic import ValidationError

from eval_poc.config import DATA_DIR
from eval_poc.models import (
    Frozen,
    Generation,
    HumanReview,
    JudgeReport,
    RetrievedChunk,
    RuleReport,
)

TRANSCRIPT_PATH = DATA_DIR / "transcript.json"


class RetrievalTrace(Frozen):
    """What the retrieval step did, in the order the UI narrates it."""

    query: str
    candidates: list[RetrievedChunk]
    kept: list[RetrievedChunk]
    top_k: int
    min_score: float
    duration_ms: float


class Turn(Frozen):
    """One question and everything learned about its answer."""

    id: str
    asked_at: str
    question: str
    # Defaults keep turns written before versioning existed loadable.
    assistant_version: str = "v2"
    assistant_label: str = "V2 — Hardened"
    case_id: str | None = None
    expected_answer: str | None = None
    retrieval: RetrievalTrace
    generation: Generation
    prompt_chars: int
    # Stored verbatim so the UI can show exactly what was sent to the model.
    system_prompt: str = ""
    user_prompt: str = ""
    rules: RuleReport | None = None
    judge: JudgeReport | None = None
    human: HumanReview | None = None

    @property
    def has_ground_truth(self) -> bool:
        return bool(self.expected_answer and self.expected_answer.strip())

    @property
    def score(self):
        """Combined score across whichever evaluation methods have run."""
        from eval_poc.scoring import score_turn

        return score_turn(self.rules, self.judge, self.human)

    @property
    def verdict(self) -> str:
        return self.score.verdict


def new_turn_id() -> str:
    return f"T-{uuid4().hex[:8]}"


def now_iso() -> str:
    return datetime.now(UTC).isoformat()


class TranscriptStore:
    """JSON-backed transcript. Turns are replaced in place as they gain evaluations."""

    def __init__(self, path: Path = TRANSCRIPT_PATH) -> None:
        self._path = path

    def load(self) -> list[Turn]:
        if not self._path.exists():
            return []
        try:
            raw = json.loads(self._path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Transcript at {self._path} is corrupt: {error}") from error

        turns: list[Turn] = []
        for item in raw.get("turns", []):
            try:
                turns.append(Turn.model_validate(item))
            except ValidationError:
                continue  # a malformed row must not block the whole session
        return turns

    def get(self, turn_id: str) -> Turn | None:
        return next((turn for turn in self.load() if turn.id == turn_id), None)

    def upsert(self, turn: Turn) -> list[Turn]:
        existing = self.load()
        replaced = [turn if item.id == turn.id else item for item in existing]
        if all(item.id != turn.id for item in existing):
            replaced = [*existing, turn]
        self._write(replaced)
        return replaced

    def clear(self) -> None:
        self._write([])

    def _write(self, turns: list[Turn]) -> None:
        self._path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "version": "1.0.0",
            "updated_at": now_iso(),
            "turns": [turn.model_dump() for turn in turns],
        }
        self._path.write_text(json.dumps(payload, indent=2, default=str), encoding="utf-8")
