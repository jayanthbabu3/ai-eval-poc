"""Phase 4: LLM-as-judge via DeepEval — correctness, completeness, faithfulness, relevancy."""

from __future__ import annotations

import os

from eval_poc.config import JudgeConfig
from eval_poc.models import (
    Generation,
    JudgeCallTrace,
    JudgeReport,
    JudgeScore,
    RetrievedChunk,
    TestCase,
)

# Set before importing deepeval so the SDK never phones home from a POC run.
os.environ.setdefault("DEEPEVAL_TELEMETRY_OPT_OUT", "YES")
os.environ.setdefault("ERROR_REPORTING", "NO")

CORRECTNESS = "correctness"
COMPLETENESS = "completeness"
FAITHFULNESS = "faithfulness"
RELEVANCY = "relevancy"
METRIC_NAMES = (CORRECTNESS, COMPLETENESS, FAITHFULNESS, RELEVANCY)

CORRECTNESS_CRITERIA = (
    "Determine whether the actual output is factually consistent with the expected "
    "output. Penalise contradictions of policy values such as durations, limits, and "
    "approval steps. Extra correct detail is acceptable; a wrong number or wrong "
    "process is not."
)
COMPLETENESS_CRITERIA = (
    "Determine whether the actual output covers every substantive point present in "
    "the expected output. Penalise omitted steps, missing thresholds, and answers "
    "that stop before the user can act."
)

# Plain-English descriptions rendered in the "what does the judge do?" modal.
METRIC_SPEC: tuple[dict, ...] = (
    {
        "name": CORRECTNESS,
        "label": "Correctness",
        "kind": "GEval (custom criteria)",
        "question": "Does it match the known-good answer, especially the numbers?",
        "criteria": CORRECTNESS_CRITERIA,
        "needs_reference": True,
        "inputs": ["question", "assistant answer", "known-good answer"],
    },
    {
        "name": COMPLETENESS,
        "label": "Completeness",
        "kind": "GEval (custom criteria)",
        "question": "Does it cover every point the known-good answer makes?",
        "criteria": COMPLETENESS_CRITERIA,
        "needs_reference": True,
        "inputs": ["question", "assistant answer", "known-good answer"],
    },
    {
        "name": FAITHFULNESS,
        "label": "Faithfulness",
        "kind": "DeepEval FaithfulnessMetric",
        "question": "Is every claim supported by the retrieved articles?",
        "criteria": (
            "Extracts each factual claim from the answer and checks it against the "
            "retrieved context. Any claim the context does not support counts against "
            "the score. Needs no reference answer."
        ),
        "needs_reference": False,
        "inputs": ["assistant answer", "retrieved articles"],
    },
    {
        "name": RELEVANCY,
        "label": "Relevancy",
        "kind": "DeepEval AnswerRelevancyMetric",
        "question": "Does it actually answer the question that was asked?",
        "criteria": (
            "Breaks the answer into statements and measures how many address the "
            "question. Padding and digressions lower the score. Needs no reference "
            "answer."
        ),
        "needs_reference": False,
        "inputs": ["question", "assistant answer"],
    },
)


class DeepEvalJudge:
    """Wraps the four DeepEval metrics behind one call.

    Construction is lazy and defensive: if DeepEval or the Groq key is missing,
    `available` is False and the pipeline records the phase as skipped rather
    than failing the whole run.
    """

    REFERENCE_REQUIRED = (CORRECTNESS, COMPLETENESS)
    NO_GROUND_TRUTH = (
        "needs a reference answer — this question has no curated ground truth, "
        "so there is nothing to compare against"
    )

    def __init__(self, config: JudgeConfig) -> None:
        self._config = config
        self._metrics = None
        self._recorder = None
        self._unavailable_reason: str | None = None

    def spec(self) -> dict:
        """Everything the UI needs to explain the judge before it runs."""
        return {
            "judge_model": self._config.model,
            "threshold": self._config.threshold,
            "temperature": self._config.temperature,
            "metrics": list(METRIC_SPEC),
            "note": (
                "The judge is a different model from the one under test, and it is "
                "shown the question, the answer, and the retrieved articles. Prompts "
                "are built by DeepEval; after a run you can read the exact text that "
                "was sent."
            ),
        }

    @property
    def available(self) -> bool:
        self._ensure_metrics()
        return self._metrics is not None

    @property
    def unavailable_reason(self) -> str | None:
        self._ensure_metrics()
        return self._unavailable_reason

    def _ensure_metrics(self) -> None:
        if self._metrics is not None or self._unavailable_reason is not None:
            return
        try:
            self._metrics = self._build_metrics()
        except Exception as error:  # noqa: BLE001 - judge is optional, never fatal
            self._unavailable_reason = f"{type(error).__name__}: {error}"

    def _build_metrics(self) -> dict:
        from deepeval.metrics import AnswerRelevancyMetric, FaithfulnessMetric, GEval
        from deepeval.test_case import LLMTestCaseParams

        from eval_poc.llm.judge_model import GroqJudgeModel, JudgeRecorder

        self._recorder = JudgeRecorder()
        judge = GroqJudgeModel(
            self._config.model, self._config.temperature, recorder=self._recorder
        )
        shared = {"model": judge, "threshold": self._config.threshold, "async_mode": False}
        reference_params = [
            LLMTestCaseParams.INPUT,
            LLMTestCaseParams.ACTUAL_OUTPUT,
            LLMTestCaseParams.EXPECTED_OUTPUT,
        ]

        return {
            CORRECTNESS: GEval(
                name="Correctness",
                criteria=CORRECTNESS_CRITERIA,
                evaluation_params=reference_params,
                **shared,
            ),
            COMPLETENESS: GEval(
                name="Completeness",
                criteria=COMPLETENESS_CRITERIA,
                evaluation_params=reference_params,
                **shared,
            ),
            FAITHFULNESS: FaithfulnessMetric(**shared),
            RELEVANCY: AnswerRelevancyMetric(**shared),
        }

    def evaluate(
        self,
        case: TestCase | None,
        generation: Generation,
        chunks: list[RetrievedChunk],
        *,
        question: str | None = None,
        expected_answer: str | None = None,
    ) -> JudgeReport:
        asked = question if question is not None else (case.question if case else "")
        reference = expected_answer if expected_answer is not None else (
            case.expected_answer if case else None
        )

        if generation.stubbed:
            return JudgeReport(skipped_reason="answer was an offline stub, not model output")
        if not generation.answer:
            return JudgeReport(skipped_reason="generation produced no answer to judge")

        self._ensure_metrics()
        if self._metrics is None:
            return JudgeReport(skipped_reason=self._unavailable_reason or "judge unavailable")

        from deepeval.test_case import LLMTestCase

        has_reference = bool(reference and reference.strip())
        test_case = LLMTestCase(
            input=asked,
            actual_output=generation.answer,
            expected_output=reference or "",
            retrieval_context=[chunk.content for chunk in chunks] or ["(no context retrieved)"],
        )

        if self._recorder is not None:
            self._recorder.drain()  # discard anything from a previous turn

        scores, unscorable = [], {}
        for name, metric in self._metrics.items():
            if name in self.REFERENCE_REQUIRED and not has_reference:
                unscorable[name] = self.NO_GROUND_TRUTH
                continue
            if self._recorder is not None:
                self._recorder.start(name)
            scores.append(self._measure(name, metric, test_case))

        traces = [
            JudgeCallTrace(
                metric=call.metric,
                stage=call.stage,
                system_prompt=call.system_prompt,
                prompt=call.prompt,
                raw_response=call.raw_response,
                latency_ms=call.latency_ms,
            )
            for call in (self._recorder.drain() if self._recorder is not None else [])
        ]
        return JudgeReport(scores=scores, unscorable=unscorable, traces=traces)

    def _measure(self, name: str, metric, test_case) -> JudgeScore:
        """A failed call is reported as an error, never as a score of zero.

        Rate limits and dropped connections say nothing about answer quality;
        scoring them 0.0 would make an outage look like a broken assistant.
        """
        try:
            metric.measure(test_case)
        except Exception as error:  # noqa: BLE001 - one bad metric must not sink the run
            return JudgeScore(
                metric=name,
                score=0.0,
                threshold=self._config.threshold,
                reason=f"the judge could not be reached: {type(error).__name__}",
                error=f"{type(error).__name__}: {error}"[:400],
            )

        score = float(metric.score if metric.score is not None else 0.0)
        return JudgeScore(
            metric=name,
            score=max(0.0, min(1.0, score)),
            threshold=self._config.threshold,
            reason=(metric.reason or "no reason returned")[:600],
        )
