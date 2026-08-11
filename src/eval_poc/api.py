"""FastAPI surface consumed by the React dashboard."""

from __future__ import annotations

from threading import Lock

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from eval_poc.assistant_service import AssistantService, TurnNotFoundError
from eval_poc.assistants.registry import UnknownVersionError, list_versions
from eval_poc.config import load_config, load_secrets
from eval_poc.evaluators.human import HumanReviewStore, new_review, rubric_payload
from eval_poc.evaluators.rules import rule_catalogue
from eval_poc.knowledge.json_store import load_documents
from eval_poc.pipeline import EvaluationPipeline, load_test_cases
from eval_poc.report import build_run_payload, load_run, render_markdown, save_markdown, save_run

app = FastAPI(title="AI Evaluation POC", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_run_lock = Lock()
_compare_lock = Lock()
_review_store = HumanReviewStore()
_assistant = AssistantService()


def _with_score(turn) -> dict:
    """Turns are sent with their combined score already computed."""
    return {**turn.model_dump(), "score": turn.score.model_dump()}


class RunRequest(BaseModel):
    use_judge: bool = True
    case_ids: list[str] | None = None


class ReviewRequest(BaseModel):
    case_id: str = Field(min_length=1)
    reviewer: str = Field(default="anonymous", max_length=80)
    correctness: int = Field(ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    comment: str = Field(default="", max_length=1000)


class AskRequest(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    case_id: str | None = None
    version: str | None = None


class TurnReviewRequest(BaseModel):
    reviewer: str = Field(default="anonymous", max_length=80)
    correctness: int = Field(ge=1, le=5)
    completeness: int = Field(default=3, ge=1, le=5)
    clarity: int = Field(ge=1, le=5)
    tone: int = Field(default=3, ge=1, le=5)
    ship_it: bool = True
    comment: str = Field(default="", max_length=1000)


class CompareRequest(BaseModel):
    case_ids: list[str] = Field(min_length=1, max_length=12)


# --------------------------------------------------------------------------
# Meta
# --------------------------------------------------------------------------


@app.get("/api/health")
def health() -> dict:
    config = load_config()
    return {
        "status": "ok",
        "groq_configured": load_secrets().has_groq,
        "generation_model": config.generation.model,
        "judge_model": config.judge.model,
        "judge_threshold": config.judge.threshold,
        "has_saved_run": load_run() is not None,
    }


@app.get("/api/rules")
def rules() -> dict:
    catalogue = rule_catalogue()
    return {"count": len(catalogue), "rules": catalogue}


@app.get("/api/assistants")
def assistants() -> dict:
    """Both versions with their full prompts, so the UI can show what differs."""
    return {"versions": [version.model_dump() for version in list_versions()]}


@app.get("/api/human-rubric")
def human_rubric() -> dict:
    return rubric_payload()


@app.get("/api/judge/spec")
def judge_spec() -> dict:
    return _assistant.judge.spec()


@app.get("/api/knowledge")
def knowledge() -> dict:
    documents = load_documents()
    return {"count": len(documents), "documents": [doc.model_dump() for doc in documents]}


@app.get("/api/test-cases")
def test_cases() -> dict:
    cases = load_test_cases()
    return {"count": len(cases), "cases": [case.model_dump() for case in cases]}


# --------------------------------------------------------------------------
# Live assistant session (the demo path)
# --------------------------------------------------------------------------


@app.get("/api/session")
def session() -> dict:
    turns = _assistant.transcript()
    return {"count": len(turns), "turns": [_with_score(turn) for turn in turns]}


@app.post("/api/session/ask")
def ask(request: AskRequest) -> dict:
    """Retrieve and answer. Evaluation is deliberately a separate call."""
    expected: str | None = None
    question = request.question.strip()

    if request.case_id:
        case = next((c for c in load_test_cases() if c.id == request.case_id), None)
        if case is None:
            raise HTTPException(status_code=400, detail=f"Unknown case id: {request.case_id}")
        question, expected = case.question, case.expected_answer

    try:
        turn = _assistant.ask(
            question,
            case_id=request.case_id,
            expected_answer=expected,
            version_id=request.version,
        )
    except UnknownVersionError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    return _with_score(turn)


@app.post("/api/session/{turn_id}/rules")
def evaluate_turn_rules(turn_id: str) -> dict:
    try:
        return _with_score(_assistant.run_rules(turn_id))
    except TurnNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/session/{turn_id}/judge")
def evaluate_turn_judge(turn_id: str) -> dict:
    try:
        return _with_score(_assistant.run_judge(turn_id))
    except TurnNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.post("/api/session/{turn_id}/review")
def review_turn(turn_id: str, request: TurnReviewRequest) -> dict:
    review = new_review(
        case_id=turn_id,
        reviewer=request.reviewer,
        correctness=request.correctness,
        completeness=request.completeness,
        clarity=request.clarity,
        tone=request.tone,
        ship_it=request.ship_it,
        comment=request.comment,
    )
    try:
        return _with_score(_assistant.save_human_review(turn_id, review))
    except TurnNotFoundError as error:
        raise HTTPException(status_code=404, detail=str(error)) from error


@app.get("/api/session/score")
def session_score() -> dict:
    return _assistant.suite_score()


@app.post("/api/compare")
def compare(request: CompareRequest) -> dict:
    """Run the same questions through every assistant version and score both."""
    if not _compare_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="A comparison is already running.")
    try:
        return _assistant.compare(request.case_ids)
    except ValueError as error:
        raise HTTPException(status_code=400, detail=str(error)) from error
    finally:
        _compare_lock.release()


@app.delete("/api/session")
def clear_session() -> dict:
    _assistant.clear()
    return {"cleared": True}


# --------------------------------------------------------------------------
# Batch suite
# --------------------------------------------------------------------------


@app.get("/api/run")
def latest_run() -> dict:
    payload = load_run()
    if payload is None:
        raise HTTPException(status_code=404, detail="No evaluation run found. Run one first.")
    return payload


@app.post("/api/run")
def trigger_run(request: RunRequest) -> dict:
    if not _run_lock.acquire(blocking=False):
        raise HTTPException(status_code=409, detail="An evaluation run is already in progress.")
    try:
        config = load_config()
        cases = load_test_cases()
        if request.case_ids:
            wanted = set(request.case_ids)
            cases = [case for case in cases if case.id in wanted]
            if not cases:
                raise HTTPException(status_code=400, detail="No test cases matched the given IDs.")

        pipeline = EvaluationPipeline(config=config)
        records = pipeline.run(cases, use_judge=request.use_judge)
        payload = build_run_payload(records, config)
        save_run(payload)
        save_markdown(payload)
        return payload
    finally:
        _run_lock.release()


@app.get("/api/report/markdown")
def report_markdown() -> dict:
    payload = load_run()
    if payload is None:
        raise HTTPException(status_code=404, detail="No evaluation run found. Run one first.")
    return {"markdown": render_markdown(payload)}


@app.get("/api/reviews")
def reviews() -> dict:
    stored = _review_store.load()
    return {"count": len(stored), "reviews": [review.model_dump() for review in stored]}


@app.post("/api/reviews")
def submit_review(request: ReviewRequest) -> dict:
    known_ids = {case.id for case in load_test_cases()}
    if request.case_id not in known_ids:
        raise HTTPException(status_code=400, detail=f"Unknown case id: {request.case_id}")

    review = new_review(
        case_id=request.case_id,
        reviewer=request.reviewer,
        correctness=request.correctness,
        clarity=request.clarity,
        comment=request.comment,
    )
    stored = _review_store.save(review)
    return {"saved": review.model_dump(), "count": len(stored)}
