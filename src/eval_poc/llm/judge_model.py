"""Groq-backed judge model for DeepEval.

DeepEval defaults to OpenAI. This adapter satisfies `DeepEvalBaseLLM` so every
metric is judged by a Groq model instead — no OpenAI key anywhere in the POC.

Contract (deepeval 4.x): for non-native models the metrics call
`generate_with_schema(prompt, schema=SchemaCls)`, whose base implementation
forwards to `generate(prompt, schema=...)` and accepts either a schema instance
or a JSON string back.
"""

from __future__ import annotations

import asyncio
import json
from dataclasses import dataclass, field
from typing import Any

from deepeval.models.base_model import DeepEvalBaseLLM
from pydantic import BaseModel, ValidationError

from eval_poc.llm.groq_client import GroqClient, GroqUnavailableError

JUDGE_SYSTEM_PROMPT = (
    "You are a strict evaluation judge. Follow the instructions exactly and "
    "return only the requested JSON object with no prose or markdown fences."
)


@dataclass
class JudgeCall:
    """One real request/response pair between us and the judge model."""

    metric: str
    stage: str
    system_prompt: str
    prompt: str
    raw_response: str
    latency_ms: float


@dataclass
class JudgeRecorder:
    """Captures every judge call so the UI can show exactly what was sent.

    DeepEval builds its prompts internally; rather than reconstructing them (which
    would risk showing something we never actually sent), this records the real
    string at the point it crosses into our Groq client.
    """

    calls: list[JudgeCall] = field(default_factory=list)
    current_metric: str = "unknown"

    def start(self, metric: str) -> None:
        self.current_metric = metric

    def record(self, *, system_prompt: str, prompt: str, response: str, latency_ms: float) -> None:
        # GEval asks for evaluation steps first, then the actual scoring call.
        stage = "evaluation steps" if "evaluation steps" in prompt.lower()[:400] else "scoring"
        self.calls.append(
            JudgeCall(
                metric=self.current_metric,
                stage=stage,
                system_prompt=system_prompt,
                prompt=prompt,
                raw_response=response,
                latency_ms=latency_ms,
            )
        )

    def drain(self) -> list[JudgeCall]:
        collected = list(self.calls)
        self.calls.clear()
        return collected


class GroqJudgeModel(DeepEvalBaseLLM):
    """Adapter exposing a Groq chat model as a DeepEval judge."""

    def __init__(
        self,
        model: str,
        temperature: float = 0.0,
        client: GroqClient | None = None,
        recorder: JudgeRecorder | None = None,
    ):
        self._model_name = model
        self._temperature = temperature
        self._client = client or GroqClient()
        self._recorder = recorder
        if not self._client.available:
            raise GroqUnavailableError(
                "GROQ_API_KEY is not set, so the DeepEval judge cannot run."
            )
        super().__init__(model)

    def load_model(self) -> GroqClient:
        return self._client

    def get_model_name(self) -> str:
        return f"Groq {self._model_name}"

    def generate(self, prompt: str, schema: type[BaseModel] | None = None) -> Any:
        rendered = _with_schema_instructions(prompt, schema)
        result = self._client.complete(
            system=JUDGE_SYSTEM_PROMPT,
            user=rendered,
            model=self._model_name,
            temperature=self._temperature,
            max_tokens=1024,
            json_mode=schema is not None,
        )
        if self._recorder is not None:
            self._recorder.record(
                system_prompt=JUDGE_SYSTEM_PROMPT,
                prompt=rendered,
                response=result.text or (result.error or ""),
                latency_ms=result.latency_ms,
            )
        if result.error:
            raise RuntimeError(f"Groq judge call failed: {result.error}")
        if schema is None:
            return result.text
        return _parse_into_schema(result.text, schema)

    async def a_generate(self, prompt: str, schema: type[BaseModel] | None = None) -> Any:
        # The Groq SDK call is blocking; offload it so async metrics stay responsive.
        return await asyncio.to_thread(self.generate, prompt, schema)


def _with_schema_instructions(prompt: str, schema: type[BaseModel] | None) -> str:
    """Groq's json_object mode needs the shape spelled out in the prompt."""
    if schema is None:
        return prompt
    return (
        f"{prompt}\n\n"
        "Respond with a single JSON object matching this JSON schema exactly:\n"
        f"{json.dumps(schema.model_json_schema())}"
    )


def _parse_into_schema(text: str, schema: type[BaseModel]) -> BaseModel:
    payload = _extract_json_object(text)
    try:
        return schema.model_validate(payload)
    except ValidationError as error:
        raise RuntimeError(
            f"Judge returned JSON that does not match {schema.__name__}: {error}"
        ) from error


def _extract_json_object(text: str) -> dict[str, Any]:
    """Parse the model's JSON, tolerating stray prose or markdown fences."""
    cleaned = text.strip().removeprefix("```json").removeprefix("```").removesuffix("```")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass

    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(cleaned[start : end + 1])
        except json.JSONDecodeError as error:
            raise RuntimeError(f"Judge did not return valid JSON: {error}") from error
    raise RuntimeError("Judge returned no JSON object")
