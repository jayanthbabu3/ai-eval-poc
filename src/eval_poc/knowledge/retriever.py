"""Retriever protocol — the seam where ServiceNow or a vector DB drops in later."""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from eval_poc.models import RetrievedChunk


@runtime_checkable
class Retriever(Protocol):
    """Any backend that turns a question into ranked knowledge chunks."""

    def search(self, query: str, top_k: int) -> list[RetrievedChunk]:
        """Return at most `top_k` chunks, highest score first."""
        ...
