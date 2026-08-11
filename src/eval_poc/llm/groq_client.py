"""Thin Groq wrapper that measures latency and degrades to an offline stub."""

from __future__ import annotations

import time
from dataclasses import dataclass

from eval_poc.config import load_secrets

# Long comparison runs make dozens of calls back to back; connections go stale and
# rate limits bite. Retrying transient failures keeps a demo from showing empty
# answers for reasons that have nothing to do with the assistant's quality.
MAX_ATTEMPTS = 3
BACKOFF_SECONDS = (0.5, 1.5)
TRANSIENT_ERRORS = (
    "APIConnectionError",
    "APITimeoutError",
    "RateLimitError",
    "InternalServerError",
    "ServiceUnavailable",
)


def _is_transient(error: Exception) -> bool:
    name = type(error).__name__
    if name in TRANSIENT_ERRORS:
        return True
    status = getattr(error, "status_code", None)
    return status in {408, 429, 500, 502, 503, 504}


@dataclass(frozen=True)
class ChatResult:
    text: str
    latency_ms: float
    prompt_tokens: int
    completion_tokens: int
    stubbed: bool
    error: str | None = None


class GroqUnavailableError(RuntimeError):
    """Raised when a caller demands Groq but no usable client exists."""


class GroqClient:
    """Chat completion client. `available` is False when no API key is present."""

    def __init__(self, api_key: str | None = None) -> None:
        self._api_key = api_key if api_key is not None else load_secrets().groq_api_key
        self._client = self._build_client()

    def _build_client(self):
        if not self._api_key:
            return None
        try:
            from groq import Groq
        except ImportError as error:  # pragma: no cover - dependency guard
            raise RuntimeError(
                "The 'groq' package is not installed. Run: pip install -r requirements.txt"
            ) from error
        return Groq(api_key=self._api_key)

    @property
    def available(self) -> bool:
        return self._client is not None

    def complete(
        self,
        *,
        system: str,
        user: str,
        model: str,
        temperature: float,
        max_tokens: int,
        json_mode: bool = False,
    ) -> ChatResult:
        """Run one completion. Never raises on API failure — errors ride in the result."""
        if self._client is None:
            return ChatResult(
                text=_offline_stub(user),
                latency_ms=0.0,
                prompt_tokens=0,
                completion_tokens=0,
                stubbed=True,
            )

        started = time.perf_counter()
        response = None
        last_error: Exception | None = None

        for attempt in range(MAX_ATTEMPTS):
            try:
                response = self._client.chat.completions.create(
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    messages=[
                        {"role": "system", "content": system},
                        {"role": "user", "content": user},
                    ],
                    **({"response_format": {"type": "json_object"}} if json_mode else {}),
                )
                break
            except Exception as error:  # noqa: BLE001 - surface any provider failure as data
                last_error = error
                if attempt == MAX_ATTEMPTS - 1 or not _is_transient(error):
                    break
                time.sleep(BACKOFF_SECONDS[min(attempt, len(BACKOFF_SECONDS) - 1)])

        if response is None:
            elapsed = (time.perf_counter() - started) * 1000
            return ChatResult(
                text="",
                latency_ms=round(elapsed, 2),
                prompt_tokens=0,
                completion_tokens=0,
                stubbed=False,
                error=f"{type(last_error).__name__}: {last_error}",
            )

        elapsed = (time.perf_counter() - started) * 1000
        usage = getattr(response, "usage", None)
        return ChatResult(
            text=(response.choices[0].message.content or "").strip(),
            latency_ms=round(elapsed, 2),
            prompt_tokens=getattr(usage, "prompt_tokens", 0) or 0,
            completion_tokens=getattr(usage, "completion_tokens", 0) or 0,
            stubbed=False,
        )


def _offline_stub(user_prompt: str) -> str:
    """Deterministic placeholder so phases 1, 3 and 5 stay demonstrable with no key."""
    # Wording deliberately avoids the rule engine's forbidden terms so the stub
    # does not manufacture a security violation against itself.
    return (
        "[OFFLINE STUB] No Groq credential is configured, so no model was called. "
        "This placeholder answer is generated locally and is scored by the rule "
        "engine only. Configure the credential in .env to evaluate real model "
        f"output. The prompt was {len(user_prompt)} characters long."
    )
